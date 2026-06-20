-- Coordinatie & Admin systeem, Fase 2 — account-verificatie en rate
-- limiting (database-deel). Handmatig uitvoeren in de Supabase
-- SQL-editor (zie CLAUDE.md "Database-schema (Supabase)").
--
-- Buiten dit bestand (bewust niet hier, vereist dashboard-instellingen
-- resp. een extern account):
--   - E-mailverificatie aanzetten: Supabase Auth settings.
--   - Telefoonverificatie (telefoon_geverifieerd, trust_score +15): vereist
--     een SMS-provider (bv. Twilio) gekoppeld in Supabase Auth settings.

-- Fix: migratie 0002 zette account_aangemaakt op user_profiles met
-- DEFAULT now(), dus bestaande gebruikers kregen de migratie-uitvoertijd
-- als registratiedatum i.p.v. hun werkelijke signup-moment. Backfillen
-- vanuit auth.users.created_at (user_profiles.id = auth.users.id).
UPDATE user_profiles p
SET account_aangemaakt = u.created_at
FROM auth.users u
WHERE p.id = u.id;

-- Automatisch op 'under_review' zetten van meldingen van nieuwe accounts:
-- - account < 48u oud: altijd under_review.
-- - account < 7 dagen oud EN al >=5 meldingen in de afgelopen 24u: ook
--   under_review (geen harde rate-limit/insert-weigering, om de
--   offline-sync-queue in useSupabaseSync.js niet te laten breken op een
--   database-foutmelding bij synchroniseren).
-- Leest auth.users.created_at rechtstreeks (i.p.v. user_profiles.account_aangemaakt)
-- zodat dit niet opnieuw stuk kan lopen op een verkeerd gebackfilde kolom.
CREATE OR REPLACE FUNCTION fn_entries_set_visibility()
RETURNS trigger AS $$
DECLARE
  account_leeftijd interval;
  meldingen_vandaag integer;
BEGIN
  SELECT now() - u.created_at INTO account_leeftijd
  FROM auth.users u
  WHERE u.id = NEW.user_id;

  -- Onbekende gebruiker (zou niet moeten voorkomen): niets aanpassen
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

DROP TRIGGER IF EXISTS trg_entries_set_visibility ON entries;
CREATE TRIGGER trg_entries_set_visibility
  BEFORE INSERT ON entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_entries_set_visibility();
