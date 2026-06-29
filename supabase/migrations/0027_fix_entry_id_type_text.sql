-- Migratie 0027: herstel type-mismatch p_entry_id bigint → text
--
-- entries.id is een text-kolom ('DL-…'-formaat, gegenereerd door generateId()
-- in src/utils/format.js). Migratie 0023 definieerde fn_trust_score_actie_bonus
-- en trust_score_events.entry_id echter als bigint — een silent type-mismatch
-- die pas op productie zichtbaar werd bij de eerste INSERT:
--   "function fn_trust_score_actie_bonus(uuid, unknown, text) does not exist"
--
-- STAP 1: kolom entry_id van bigint naar text (bestaande NULLs blijven NULL)
ALTER TABLE trust_score_events ALTER COLUMN entry_id TYPE text USING entry_id::text;

-- De dedup-index verwijst naar entry_id — opnieuw aanmaken met het nieuwe type
DROP INDEX IF EXISTS trust_score_events_dedup;
CREATE INDEX trust_score_events_dedup
  ON trust_score_events(user_id, actie, entry_id);

-- STAP 2: verwijder de old bigint-overload en maak de functie opnieuw met text
DROP FUNCTION IF EXISTS fn_trust_score_actie_bonus(uuid, text, bigint);

CREATE OR REPLACE FUNCTION fn_trust_score_actie_bonus(
  p_user_id  uuid,
  p_actie    text,
  p_entry_id text DEFAULT NULL
) RETURNS integer AS $$
DECLARE
  account_leeftijd  interval;
  normale_meldingen integer;
  dagelijkse_bonus  integer;
  misbruik_count    integer;
  delta             integer := 0;
  p_entry           entries%ROWTYPE;
BEGIN
  -- Guard 1: account moet >= 30 dagen oud zijn
  SELECT now() - u.created_at INTO account_leeftijd
  FROM auth.users u WHERE u.id = p_user_id;
  IF account_leeftijd IS NULL OR account_leeftijd < interval '30 days' THEN
    RETURN 0;
  END IF;

  -- Guard 2: minimaal 5 normale meldingen als schone basis
  SELECT count(*) INTO normale_meldingen
  FROM entries
  WHERE user_id = p_user_id
    AND visibility = 'normal'
    AND deleted = false;
  IF normale_meldingen < 5 THEN
    RETURN 0;
  END IF;

  -- Guard 3: deduplicatie
  IF p_entry_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM trust_score_events
      WHERE user_id = p_user_id AND actie = p_actie AND entry_id = p_entry_id
    ) THEN RETURN 0; END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM trust_score_events
      WHERE user_id = p_user_id AND actie = p_actie
    ) THEN RETURN 0; END IF;
  END IF;

  -- Guard 4: dagelijkse cap (+5 per dag) alleen voor per-entry bonussen
  IF p_entry_id IS NOT NULL THEN
    SELECT COALESCE(SUM(delta), 0) INTO dagelijkse_bonus
    FROM trust_score_events
    WHERE user_id = p_user_id
      AND created_at > now() - interval '1 day'
      AND delta > 0
      AND entry_id IS NOT NULL;
    IF dagelijkse_bonus >= 5 THEN RETURN 0; END IF;
  END IF;

  -- Guard 5: entry-specifieke checks (visibility + misbruikpatroon)
  IF p_entry_id IS NOT NULL THEN
    SELECT * INTO p_entry FROM entries WHERE id = p_entry_id;

    IF p_entry.visibility IN ('shadow', 'under_review') THEN
      RETURN 0;
    END IF;

    IF p_entry.perceelnummer IS NOT NULL THEN
      SELECT count(*) INTO misbruik_count
      FROM entries
      WHERE user_id = p_user_id
        AND perceelnummer = p_entry.perceelnummer
        AND created_at > now() - interval '24 hours'
        AND deleted = false;
      IF misbruik_count >= 5 THEN RETURN 0; END IF;
    END IF;
  END IF;

  -- Delta per actie
  delta := CASE p_actie
    WHEN 'melding_volledig'      THEN 2
    WHEN 'opt_in_buurt'         THEN 3
    WHEN 'drempel_5_meldingen'  THEN 3
    WHEN 'drempel_10_meldingen' THEN 5
    WHEN 'drempel_25_meldingen' THEN 5
    WHEN 'drempel_50_meldingen' THEN 5
    WHEN 'telefoon_geverifieerd' THEN 8
    ELSE 0
  END;
  IF delta = 0 THEN RETURN 0; END IF;

  -- Dagelijkse cap afkappen (alleen voor per-entry)
  IF p_entry_id IS NOT NULL THEN
    delta := LEAST(delta, 5 - dagelijkse_bonus);
    IF delta <= 0 THEN RETURN 0; END IF;
  END IF;

  INSERT INTO trust_score_events(user_id, actie, delta, entry_id)
  VALUES (p_user_id, p_actie, delta, p_entry_id);

  UPDATE user_profiles
  SET trust_score = GREATEST(0, LEAST(100, trust_score + delta))
  WHERE id = p_user_id;

  RETURN delta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- fn_entries_actie_bonus en fn_user_profiles_telefoon_bonus roepen de functie
-- aan via PERFORM — die lossen het type van NEW.id/NULL vanzelf op nu de
-- enige overload text is. Triggers hoeven niet opnieuw aangemaakt te worden.
