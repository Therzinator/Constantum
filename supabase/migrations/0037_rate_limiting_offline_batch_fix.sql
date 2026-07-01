-- Migratie 0037: preventieve rate-limiting + offline-batch-fix in bestaande
-- misbruikdetectie
--
-- Aanleiding: de bestaande volumecontroles (migratie 0005,
-- fn_entries_set_visibility en fn_entries_misbruikdetectie) tellen recente
-- meldingen op basis van created_at (het moment van INSERT/sync). Dat werkt
-- averechts voor deze offline-first app: iemand die een paar dagen zonder
-- bereik zit en dan in één batch-upsert synct, laat al zijn meldingen
-- vrijwel gelijktijdig created_at krijgen, ook al zijn de eigenlijke
-- waarnemingsmomenten (timestamp_local) over meerdere dagen verspreid.
-- Zo'n legitieme catch-up-sync kon daardoor nu al ten onrechte onder_review
-- opleveren voor nieuwe accounts (<7 dagen) resp. een trust-score-penalty
-- voor "perceel-spam" — vóór er ooit een nieuwe rate-limit-trigger bijkwam.
--
-- Deze migratie:
--   1. Voegt aan beide bestaande tijdvenster-checks een dubbele voorwaarde
--      toe: een melding telt alleen mee als hij ZOWEL recent is aangemaakt
--      (created_at, serverzijdig betrouwbaar) ALS recent waargenomen
--      (timestamp_local, door de client gezet op het moment van opslaan —
--      niet aanpasbaar via enig UI-element, dus niet vrij te vervalsen door
--      gewoon met de app te werken; een aanvaller die rechtstreeks de
--      Supabase-API omzeilt zou dit sowieso al kunnen omzeilen, dat is geen
--      nieuwe zwakte t.o.v. de huidige created_at-only-aanpak).
--   2. Voegt een NIEUWE preventieve check toe aan fn_entries_set_visibility
--      (BEFORE INSERT, dus zonder de insert zelf te laten falen — géén
--      risico voor de batch-upsert-transactie): >= 15 meldingen van
--      dezelfde gebruiker met ZOWEL created_at ALS timestamp_local binnen
--      het laatste uur → direct 'shadow', ongeacht trust-tier (dekt ook een
--      gecompromitteerd hoog-vertrouwen-account). Drempel is een schatting,
--      geen gemeten waarde — bijstellen als 15/uur in de praktijk te streng
--      of te soepel blijkt.

-- ── fn_entries_set_visibility: live-burst-check + timestamp_local-fix ─────
CREATE OR REPLACE FUNCTION fn_entries_set_visibility()
RETURNS trigger AS $$
DECLARE
  account_leeftijd    interval;
  meldingen_vandaag   integer;
  huidige_trust_score integer;
  live_burst_aantal   integer;
BEGIN
  -- Nieuwe preventieve check: geldt voor iedereen, ongeacht trust-tier.
  -- Alleen meldingen die ZOWEL nu net zijn aangemaakt ALS een recent
  -- waarnemingsmoment claimen tellen mee — een offline-catch-up-sync van
  -- oudere, echte waarnemingen triggert dit dus niet.
  SELECT count(*) INTO live_burst_aantal
  FROM entries
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour'
    AND timestamp_local > now() - interval '1 hour';

  IF live_burst_aantal >= 15 THEN
    NEW.visibility := 'shadow';
    RETURN NEW;
  END IF;

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

  -- Standaard (40-79): nieuw-account-checks
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
    -- Dubbele voorwaarde (offline-batch-fix, zie migratie-toelichting):
    -- eerder alleen created_at, nu ook timestamp_local vereist.
    SELECT count(*) INTO meldingen_vandaag
    FROM entries
    WHERE user_id = NEW.user_id
      AND created_at > now() - interval '1 day'
      AND timestamp_local > now() - interval '1 day';

    IF meldingen_vandaag >= 5 THEN
      NEW.visibility := 'under_review';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── fn_entries_misbruikdetectie: zelfde offline-batch-fix op de ───────────
-- ── perceel-spamcheck (de beschrijving-duplicaatcheck heeft geen ─────────
-- ── tijdvenster en is dus niet getroffen door dit probleem) ──────────────
CREATE OR REPLACE FUNCTION fn_entries_misbruikdetectie()
RETURNS trigger AS $$
DECLARE
  perceel_aantal      integer;
  beschrijving_aantal integer;
BEGIN
  IF NEW.perceelnummer IS NOT NULL THEN
    SELECT count(*) INTO perceel_aantal
    FROM entries
    WHERE user_id = NEW.user_id
      AND perceelnummer = NEW.perceelnummer
      AND created_at > now() - interval '24 hours'
      AND timestamp_local > now() - interval '24 hours';

    IF perceel_aantal = 11 THEN
      UPDATE user_profiles
      SET trust_score = GREATEST(0, LEAST(100, trust_score - 20))
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  IF NEW.description IS NOT NULL AND length(trim(NEW.description)) > 0 THEN
    SELECT count(*) INTO beschrijving_aantal
    FROM entries
    WHERE user_id = NEW.user_id
      AND description = NEW.description;

    IF beschrijving_aantal = 2 THEN
      UPDATE user_profiles
      SET trust_score = GREATEST(0, LEAST(100, trust_score - 15))
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
