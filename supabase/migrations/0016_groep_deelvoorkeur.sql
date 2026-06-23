-- Groepen — automatisch delen op basis van twee gekoppelde instellingen,
-- vervangt de eerdere handmatige "kies per melding welke groep"-aanpak
-- (GroepPage.jsx, entries_groepen rechtstreeks vanuit de UI gevuld).
-- Bevestigd door de gebruiker op 2026-06-23:
--   1. Bij het melden: één checkbox "Deel deze melding met de groepen
--      waar je in zit en toestemming voor delen geeft" (entries.opt_in_groepen,
--      naast — niet i.p.v. — de bestaande "deel met de buurt"-checkbox).
--   2. Per groep, in de Groepen-interface: een blijvende toggle of je
--      meldingen met DIE groep deelt (groep_leden.deel_meldingen).
-- Een melding wordt dus alleen met een groep gedeeld als BEIDE waar zijn:
-- de melder zette de checkbox aan bij het melden, ÉN de melder had op dat
-- moment de deel-toggle voor die specifieke groep aanstaan. Beide
-- standaard UIT (privacy-first, zelfde conventie als opt_in_buurt/
-- gezondheid_toestemming) — de gebruiker moet dit zelf aanzetten.
--
-- Handmatig uitvoeren in de Supabase SQL-editor (geen migratie-tooling in
-- dit project — zie root-CLAUDE.md "Database-schema (Supabase)").

ALTER TABLE groep_leden ADD COLUMN IF NOT EXISTS deel_meldingen boolean DEFAULT false;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS opt_in_groepen boolean DEFAULT false;

-- Alleen de eigen rij, alleen deel_meldingen — een open UPDATE-policy op
-- groep_leden zou een lid ook zijn eigen 'rol' laten wijzigen (privilege-
-- escalatie naar hoofdbeheerder), dus bewust een smalle SECURITY DEFINER-
-- functie i.p.v. een RLS UPDATE-policy, zelfde patroon als de overige
-- fn_groep_*-functies (migratie 0015).
CREATE OR REPLACE FUNCTION fn_groep_deelvoorkeur_wijzigen(p_groep_id uuid, p_deel_meldingen boolean)
RETURNS boolean AS $$
BEGIN
  UPDATE groep_leden
  SET deel_meldingen = p_deel_meldingen
  WHERE groep_id = p_groep_id AND user_id = auth.uid();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_groep_deelvoorkeur_wijzigen(uuid, boolean) TO authenticated;

-- Vult entries_groepen automatisch op het moment van melden — alleen voor
-- groepen waar de melder op dat moment de deel-toggle aan had staan. Een
-- latere wijziging van de toggle werkt alleen op toekomstige meldingen,
-- niet retroactief op al gedeelde meldingen (zelfde "geen achteraf-
-- herberekening"-aanpak als fn_entries_set_visibility, migratie 0003/0014).
CREATE OR REPLACE FUNCTION fn_entries_deel_met_groepen()
RETURNS trigger AS $$
BEGIN
  IF NEW.opt_in_groepen IS TRUE THEN
    INSERT INTO entries_groepen (entry_id, groep_id)
    SELECT NEW.id, gl.groep_id
    FROM groep_leden gl
    WHERE gl.user_id = NEW.user_id AND gl.deel_meldingen = true
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_entries_deel_met_groepen ON entries;
CREATE TRIGGER trg_entries_deel_met_groepen
  AFTER INSERT ON entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_entries_deel_met_groepen();
