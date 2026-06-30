-- Kwetsbare Groepen profielinstelling (AVG art. 9 — bijzondere categorie)
-- Melders kunnen aangeven dat er kwetsbare personen in hun huishouden aanwezig zijn.
-- De specifieke categorieën worden alleen opgeslagen op user_profiles (niet in entries).
-- entries.kwetsbare_groep_aanwezig is een afgeleide boolean op meldingsniveau.
--
-- RLS: bestaande user_profiles-policies gelden ongewijzigd (gebruiker leest/schrijft
-- alleen zijn eigen rij; admin via SECURITY DEFINER-bypass).
-- De nieuwe kolommen in entries vallen onder de bestaande entries-RLS.
--
-- Aandachtspunt: haalAlleProfielenAdmin() selecteert expliciet id, trust_score,
-- telefoon_geverifieerd, account_aangemaakt — de kwetsbare-groepen-kolommen
-- worden NIET via die query blootgesteld. Geen aanpassing aan die query nodig.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS kwetsbare_groepen_actief boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kwetsbare_groepen jsonb,
  ADD COLUMN IF NOT EXISTS kwetsbare_groepen_toestemming_op timestamptz;

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS kwetsbare_groep_aanwezig boolean NOT NULL DEFAULT false;
