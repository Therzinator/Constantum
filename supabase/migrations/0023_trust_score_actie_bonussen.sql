-- Migratie 0023: event-driven actie-bonussen voor trust score
--
-- Beloont aantoonbaar gedrag (kwaliteitsmelding, buurtdeelname, mijlpalen,
-- telefoonverificatie). Beschermd door 5 lagen:
--
--   1. Accountleeftijd >= 30 dagen
--   2. Minimaal 5 eigen meldingen met visibility = 'normal' (schone basis)
--   3. Deduplicatie per entry (of per user voor eenmalige acties)
--   4. Dagelijkse cap +5 op entry-gebonden bonussen
--   5. Misbruikpatroon-check: >= 5 meldingen op hetzelfde perceel in 24h
--      → geen bonus, ook al zijn ze 'normal'
--
-- Acties en deltas:
--   melding_volledig      +2  (perceelnummer + niet-lege beschrijving)
--   opt_in_buurt          +3  (opt-in buurtrapport)
--   drempel_5_meldingen   +3  (eenmalig bij 5e melding)
--   drempel_10_meldingen  +5  (eenmalig bij 10e melding)
--   drempel_25_meldingen  +5  (eenmalig bij 25e melding)
--   drempel_50_meldingen  +5  (eenmalig bij 50e melding)
--   telefoon_geverifieerd +8  (eenmalig bij telefoonverificatie)
--
-- Maximale lifetime-winst via mijlpalen+telefoon: 3+5+5+5+8 = 26
-- Maximale dagelijkse winst via meldingen: +5
-- Kwartaalbonus (migratie 0022): +5 per kwartaal, ongewijzigd

-- ── trust_score_events: log van alle actie-bonussen ────────────────────────
CREATE TABLE IF NOT EXISTS trust_score_events (
  id        bigserial    PRIMARY KEY,
  user_id   uuid         NOT NULL,
  actie     text         NOT NULL,
  delta     integer      NOT NULL DEFAULT 0,
  entry_id  bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trust_score_events_user_dag
  ON trust_score_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS trust_score_events_dedup
  ON trust_score_events(user_id, actie, entry_id);

ALTER TABLE trust_score_events ENABLE ROW LEVEL SECURITY;

-- Gebruiker mag eigen log inzien (voor toekomstige "hoe werkt mijn score"-UI)
CREATE POLICY trust_score_events_eigen_lees ON trust_score_events
  FOR SELECT USING (user_id = auth.uid());

-- ── fn_trust_score_actie_bonus ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_trust_score_actie_bonus(
  p_user_id  uuid,
  p_actie    text,
  p_entry_id bigint DEFAULT NULL
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
  -- (voorkomt dat iemand direct na de 30-dagentermijn bonussen oogst)
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
    -- Per-entry bonus: controleer of deze entry al beloond is voor deze actie
    IF EXISTS (
      SELECT 1 FROM trust_score_events
      WHERE user_id = p_user_id AND actie = p_actie AND entry_id = p_entry_id
    ) THEN RETURN 0; END IF;
  ELSE
    -- Eenmalige bonus per gebruiker (mijlpaal, telefoon)
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

    -- Geen bonus voor meldingen onder toezicht of schaduw
    IF p_entry.visibility IN ('shadow', 'under_review') THEN
      RETURN 0;
    END IF;

    -- Geen bonus bij perceel-spam (>= 5 meldingen op zelfde perceel in 24h)
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

  -- Opslaan en toepassen
  INSERT INTO trust_score_events(user_id, actie, delta, entry_id)
  VALUES (p_user_id, p_actie, delta, p_entry_id);

  UPDATE user_profiles
  SET trust_score = GREATEST(0, LEAST(100, trust_score + delta))
  WHERE id = p_user_id;

  RETURN delta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── fn_entries_actie_bonus: trigger op entries-INSERT ─────────────────────
CREATE OR REPLACE FUNCTION fn_entries_actie_bonus()
RETURNS trigger AS $$
DECLARE
  totaal_meldingen integer;
BEGIN
  -- melding_volledig: perceelnummer + niet-lege beschrijving
  IF NEW.perceelnummer IS NOT NULL
     AND NEW.description IS NOT NULL
     AND trim(NEW.description) != ''
  THEN
    PERFORM fn_trust_score_actie_bonus(NEW.user_id, 'melding_volledig', NEW.id);
  END IF;

  -- opt_in_buurt
  IF NEW.opt_in_buurt = true THEN
    PERFORM fn_trust_score_actie_bonus(NEW.user_id, 'opt_in_buurt', NEW.id);
  END IF;

  -- Mijlpalen — COUNT na INSERT omvat de nieuwe rij
  SELECT count(*) INTO totaal_meldingen
  FROM entries WHERE user_id = NEW.user_id AND deleted = false;

  IF totaal_meldingen = 5 THEN
    PERFORM fn_trust_score_actie_bonus(NEW.user_id, 'drempel_5_meldingen', NULL);
  ELSIF totaal_meldingen = 10 THEN
    PERFORM fn_trust_score_actie_bonus(NEW.user_id, 'drempel_10_meldingen', NULL);
  ELSIF totaal_meldingen = 25 THEN
    PERFORM fn_trust_score_actie_bonus(NEW.user_id, 'drempel_25_meldingen', NULL);
  ELSIF totaal_meldingen = 50 THEN
    PERFORM fn_trust_score_actie_bonus(NEW.user_id, 'drempel_50_meldingen', NULL);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_entries_actie_bonus ON entries;
CREATE TRIGGER trg_entries_actie_bonus
  AFTER INSERT ON entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_entries_actie_bonus();

-- ── Telefoonverificatie-bonus ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_user_profiles_telefoon_bonus()
RETURNS trigger AS $$
BEGIN
  IF NEW.telefoon_geverifieerd = true
     AND (OLD.telefoon_geverifieerd IS NULL OR OLD.telefoon_geverifieerd = false)
  THEN
    PERFORM fn_trust_score_actie_bonus(NEW.id, 'telefoon_geverifieerd', NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_profiles_telefoon_bonus ON user_profiles;
CREATE TRIGGER trg_user_profiles_telefoon_bonus
  AFTER UPDATE OF telefoon_geverifieerd ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_user_profiles_telefoon_bonus();
