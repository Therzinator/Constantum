-- Migratie 0022: voltooi het trust-score tier-systeem
--
-- Migratie 0014 is nooit volledig uitgevoerd. De huidige DB heeft nog de
-- oude 2-tier fn_entries_set_visibility (<40 = shadow, anders standaard).
-- Dit herstelt alle 3 stappen uit 0014 in één migratie.
--
-- Stap 1 apart uitvoeren, daarna stap 2, daarna stap 3 — de SQL-editor
-- verslikt zich in meerdere $$...$$-functies achter elkaar.

-- ── STAP 1: fn_entries_set_visibility (4-tier) ──────────────────────────
-- 0-19  → shadow
-- 20-39 → under_review (nieuw: Verhoogd toezicht)
-- 40-79 → standaard (nieuw-account-checks, ongewijzigd)
-- 80+   → vertrouwd (altijd normal, geen account-checks)
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
    RETURN NEW;
  END IF;

  -- Standaard (40-79): nieuw-account-checks ongewijzigd
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

-- ── STAP 2: fn_entries_visibility_score_effect ───────────────────────────
-- Handmatige coordinator-actie beïnvloedt de trust score:
--   naar shadow  → -30 (zwaarder dan automatische -20/-15)
--   naar normal  → +5
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

-- ── STAP 3: kwartaalbonus ─────────────────────────────────────────────────
-- +5 per kwartaal voor accounts >90 dagen oud zonder recente incidenten.
-- Vereist pg_cron (zie stap 4 hieronder) of handmatige uitvoering:
--   SELECT fn_trust_score_kwartaalbonus();
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

-- ── STAP 4: pg_cron installeren + schema instellen ───────────────────────
-- Activeer pg_cron via Database → Extensions in het Supabase-dashboard,
-- of voer dit uit als superuser:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   GRANT USAGE ON SCHEMA cron TO postgres;
--
-- Daarna het kwartaalschema:
--   SELECT cron.schedule(
--     'trust_score_kwartaalbonus',
--     '0 3 1 */3 *',
--     'SELECT fn_trust_score_kwartaalbonus()'
--   );
--
-- Controleren:
--   SELECT * FROM cron.job WHERE jobname = 'trust_score_kwartaalbonus';
