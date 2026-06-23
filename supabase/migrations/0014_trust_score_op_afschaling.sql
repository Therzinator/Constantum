-- Trust-score automatische op-/afschaling — ontwerp stond in
-- docs/CURRENT_STATE.md ("Trust-score — ontwerp..."), op 2026-06-22
-- expliciet bevestigd door de gebruiker (incl. concrete getallen) vóór
-- deze migratie geschreven is. Handmatig uitvoeren in de Supabase
-- SQL-editor (geen migratie-tooling in dit project — zie CLAUDE.md).
--
-- Categorieën (trust_score op user_profiles, 0-100, default 75):
--   80-100 Vertrouwd        — meldingen altijd direct 'normal', geen
--                             nieuw-account-checks meer.
--   40-79  Standaard        — huidig gedrag: account <48u of <7 dagen
--                             oud + >=5 meldingen/dag -> under_review.
--   20-39  Verhoogd toezicht (nieuw) — ELKE nieuwe melding -> under_review,
--                             los van account-leeftijd.
--   0-19   Geschaduwd       — meldingen direct 'shadow' (drempel was <40,
--                             nu verlaagd naar <20 zodat 20-39 een eigen
--                             tussencategorie is — bevestigd: bestaande
--                             gebruikers in de 20-39-band gaan hierdoor
--                             meteen van shadow naar under_review).

-- Stap 1: fn_entries_set_visibility (migratie 0003/0005) — tier-logica
-- i.p.v. alleen de losse <40-check. Leest trust_score VAN VOOR deze
-- insert, dus alleen al vastgesteld gedrag beïnvloedt een nieuwe melding.
CREATE OR REPLACE FUNCTION fn_entries_set_visibility()
RETURNS trigger AS $$
DECLARE
  account_leeftijd interval;
  meldingen_vandaag integer;
  huidige_trust_score integer;
BEGIN
  SELECT trust_score INTO huidige_trust_score
  FROM user_profiles
  WHERE id = NEW.user_id;

  huidige_trust_score := COALESCE(huidige_trust_score, 75);

  IF huidige_trust_score < 20 THEN
    NEW.visibility := 'shadow';
    RETURN NEW;
  END IF;

  IF huidige_trust_score < 40 THEN
    NEW.visibility := 'under_review';
    RETURN NEW;
  END IF;

  IF huidige_trust_score >= 80 THEN
    RETURN NEW; -- Vertrouwd: geen nieuw-account-checks, altijd normal
  END IF;

  -- Standaard (40-79): bestaand nieuw-account-gedrag, ongewijzigd.
  SELECT now() - u.created_at INTO account_leeftijd
  FROM auth.users u
  WHERE u.id = NEW.user_id;

  IF account_leeftijd IS NULL THEN
    RETURN NEW;
  END IF;

  IF account_leeftijd < interval '48 hours' THEN
    NEW.visibility := 'under_review';
    RETURN NEW;
  END IF;

  IF account_leeftijd < interval '7 days' THEN
    SELECT count(*) INTO meldingen_vandaag
    FROM entries
    WHERE user_id = NEW.user_id
      AND created_at > now() - interval '1 day';

    IF meldingen_vandaag >= 5 THEN
      NEW.visibility := 'under_review';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stap 2: score-effect op een HANDMATIGE visibility-wijziging door een
-- coordinator/admin (zetVisibilityAdmin(), CoordinatiePage.jsx) — de
-- BEFORE INSERT-trigger hierboven raakt nooit een UPDATE, dus elke UPDATE
-- van entries.visibility is per definitie een menselijke beoordeling, niet
-- de automatische detectie. Eenmalig per overgang (OLD IS DISTINCT FROM
-- NEW), niet bij elke toekomstige update naar dezelfde waarde.
--   - naar 'shadow' (een mens beoordeelt het als misbruik) -> -30, zwaarder
--     dan de automatische -20/-15 (migratie 0005).
--   - van 'under_review'/'shadow' naar 'normal' (expliciet "✓ Goedkeuren")
--     -> +5.
CREATE OR REPLACE FUNCTION fn_entries_visibility_score_effect()
RETURNS trigger AS $$
BEGIN
  IF NEW.visibility = 'shadow' AND OLD.visibility IS DISTINCT FROM 'shadow' THEN
    UPDATE user_profiles
    SET trust_score = GREATEST(0, LEAST(100, trust_score - 30))
    WHERE id = NEW.user_id;
  ELSIF NEW.visibility = 'normal' AND OLD.visibility IN ('under_review', 'shadow') THEN
    UPDATE user_profiles
    SET trust_score = GREATEST(0, LEAST(100, trust_score + 5))
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_entries_visibility_score_effect ON entries;
CREATE TRIGGER trg_entries_visibility_score_effect
  AFTER UPDATE OF visibility ON entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_entries_visibility_score_effect();

-- Stap 3: periodieke betrouwbaarheidsbonus (+5 per kwartaal) voor accounts
-- ouder dan 90 dagen zonder enige under_review/shadow-melding in die
-- periode. Geen realtime trigger (er is geen insert-moment om dit op te
-- hangen) — een los aan te roepen functie, vereist een eigen scheduler:
--   - Met pg_cron-extensie (Database -> Extensions in het Supabase-
--     dashboard) elk kwartaal automatisch:
--       SELECT cron.schedule('trust_score_kwartaalbonus', '0 3 1 */3 *',
--         'SELECT fn_trust_score_kwartaalbonus()');
--   - Zonder pg_cron: handmatig elk kwartaal in de SQL-editor draaien:
--       SELECT fn_trust_score_kwartaalbonus();
-- laatste_trust_bonus voorkomt dat een vaker uitgevoerde aanroep de bonus
-- vaker dan elke 3 maanden toekent.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS laatste_trust_bonus timestamptz;

CREATE OR REPLACE FUNCTION fn_trust_score_kwartaalbonus()
RETURNS integer AS $$
DECLARE
  aantal_bijgewerkt integer;
BEGIN
  WITH in_aanmerking AS (
    SELECT p.id
    FROM user_profiles p
    WHERE p.account_aangemaakt < now() - interval '90 days'
      AND (p.laatste_trust_bonus IS NULL OR p.laatste_trust_bonus < now() - interval '3 months')
      AND NOT EXISTS (
        SELECT 1 FROM entries e
        WHERE e.user_id = p.id
          AND e.visibility IN ('under_review', 'shadow')
          AND e.created_at > now() - interval '90 days'
      )
  )
  UPDATE user_profiles
  SET trust_score = GREATEST(0, LEAST(100, trust_score + 5)),
      laatste_trust_bonus = now()
  WHERE id IN (SELECT id FROM in_aanmerking);

  GET DIAGNOSTICS aantal_bijgewerkt = ROW_COUNT;
  RETURN aantal_bijgewerkt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
