-- Groepenfunctie — vervangt de losse "Uitnodigen"-deeltoken-flow
-- (coordinatie_tokens, migratie 0007) door een volwaardige sociale
-- structuur: groepen met leden/rollen, eigen uitnodigingen, en een
-- expliciete melder-keuze om een melding met een specifieke groep te
-- delen (los van het bestaande opt_in_buurt/5km/30-min-systeem, dat
-- ongewijzigd blijft bestaan naast deze functie).
--
-- Trust-score blijft het bestaande globale user_profiles.trust_score
-- (migratie 0001/0014) — geen apart per-groep-veld. Hoeveel detail een
-- groepslid van een gedeelde melding ziet wordt client-side bepaald
-- (src/lib/groepen/trustZichtbaarheid.js) aan de hand van de eigen
-- trust_score van de KIJKER — deze migratie regelt alleen de
-- toegangs-gate (ben je lid van de groep waarmee gedeeld is), niet het
-- detailniveau, exact zoals het bestaande visibility-systeem nu ook geen
-- RLS-filtering op detailniveau doet.
--
-- coordinatie_tokens/verbruik_coordinatie_token/publieke_buurt_telling
-- (migratie 0002/0007) worden hier NIET gedropt — de app stopt er alleen
-- mee ze aan te roepen, geen destructieve schema-wijziging.
--
-- Handmatig uitvoeren in de Supabase SQL-editor (geen migratie-tooling in
-- dit project — zie root-CLAUDE.md "Database-schema (Supabase)").

-- ============================================================
-- Tabellen
-- ============================================================

CREATE TABLE IF NOT EXISTS groepen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  beschrijving text,
  openbaar boolean DEFAULT false,
  max_beheerders integer DEFAULT 1 CHECK (max_beheerders BETWEEN 1 AND 5),
  hoofdbeheerder_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groep_leden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groep_id uuid REFERENCES groepen(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  rol text NOT NULL DEFAULT 'lid' CHECK (rol IN ('lid', 'beheerder', 'hoofdbeheerder')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (groep_id, user_id)
);

CREATE TABLE IF NOT EXISTS groep_uitnodigingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groep_id uuid REFERENCES groepen(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  max_gebruikers integer NOT NULL CHECK (max_gebruikers BETWEEN 1 AND 5),
  gebruikt_aantal integer DEFAULT 0,
  verloopt_op timestamptz NOT NULL,
  ingetrokken boolean DEFAULT false,
  keer_geopend integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Expliciete melder-keuze: een melding wordt pas binnen een groep getoond
-- als de melder hem zelf met die groep deelt (geen automatisch alles-
-- delen-bij-lidmaatschap, bevestigd door de gebruiker).
-- entry_id is text, niet uuid: entries.id is een door de client
-- gegenereerde string (zelfde patroon als audit_log.entry_id, migratie
-- 0012 — geen Postgres-uuid).
CREATE TABLE IF NOT EXISTS entries_groepen (
  entry_id text REFERENCES entries(id) ON DELETE CASCADE NOT NULL,
  groep_id uuid REFERENCES groepen(id) ON DELETE CASCADE NOT NULL,
  gedeeld_op timestamptz DEFAULT now(),
  PRIMARY KEY (entry_id, groep_id)
);

CREATE INDEX IF NOT EXISTS idx_groep_leden_groep ON groep_leden(groep_id);
CREATE INDEX IF NOT EXISTS idx_groep_leden_user ON groep_leden(user_id);
CREATE INDEX IF NOT EXISTS idx_groep_uitnodigingen_groep ON groep_uitnodigingen(groep_id);
CREATE INDEX IF NOT EXISTS idx_entries_groepen_groep ON entries_groepen(groep_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE groepen ENABLE ROW LEVEL SECURITY;
ALTER TABLE groep_leden ENABLE ROW LEVEL SECURITY;
ALTER TABLE groep_uitnodigingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries_groepen ENABLE ROW LEVEL SECURITY;

-- groepen: openbaar zichtbaar voor iedereen (browsen), privé alleen voor
-- eigen leden, admin altijd (zelfde EXISTS-stijl als migratie 0004/0011).
CREATE POLICY "groepen_select_openbaar_of_lid_of_admin" ON groepen
  FOR SELECT USING (
    openbaar = true
    OR EXISTS (SELECT 1 FROM groep_leden gl WHERE gl.groep_id = groepen.id AND gl.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Aanmaken gaat via fn_groep_aanmaken() (SECURITY DEFINER) — geen directe
-- INSERT-policy nodig. Instellingen wijzigen mag wel rechtstreeks door de
-- hoofdbeheerder (eenvoudige UPDATE, geen rol-bewaking nodig).
CREATE POLICY "groepen_update_hoofdbeheerder_of_admin" ON groepen
  FOR UPDATE USING (
    hoofdbeheerder_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- groep_leden: alleen eigen rij, leden van dezelfde groep, of admin.
-- Mutaties (toevoegen/rol wijzigen/verwijderen) lopen uitsluitend via de
-- SECURITY DEFINER-functies hieronder — geen INSERT/UPDATE/DELETE-policy.
CREATE POLICY "groep_leden_select_eigen_of_groepslid_of_admin" ON groep_leden
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM groep_leden gl2 WHERE gl2.groep_id = groep_leden.groep_id AND gl2.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- groep_uitnodigingen: alleen beheerder/hoofdbeheerder van de eigen groep
-- mag uitnodigingen zien/aanmaken/intrekken. Accepteren (door de
-- uitgenodigde, die nog geen lid is) loopt via
-- fn_groep_uitnodiging_accepteren() (SECURITY DEFINER), niet via deze
-- policies.
CREATE POLICY "groep_uitnodigingen_select_beheerder_of_admin" ON groep_uitnodigingen
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groep_leden gl
      WHERE gl.groep_id = groep_uitnodigingen.groep_id AND gl.user_id = auth.uid() AND gl.rol IN ('beheerder', 'hoofdbeheerder')
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "groep_uitnodigingen_insert_beheerder" ON groep_uitnodigingen
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM groep_leden gl
      WHERE gl.groep_id = groep_uitnodigingen.groep_id AND gl.user_id = auth.uid() AND gl.rol IN ('beheerder', 'hoofdbeheerder')
    )
  );

CREATE POLICY "groep_uitnodigingen_update_beheerder" ON groep_uitnodigingen
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM groep_leden gl
      WHERE gl.groep_id = groep_uitnodigingen.groep_id AND gl.user_id = auth.uid() AND gl.rol IN ('beheerder', 'hoofdbeheerder')
    )
  );

-- entries_groepen: groepsleden zien welke meldingen met hun groep gedeeld
-- zijn; alleen de melder zelf mag een EIGEN melding delen/intrekken, en
-- alleen met een groep waar die melder zelf lid van is.
CREATE POLICY "entries_groepen_select_groepslid_of_admin" ON entries_groepen
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM groep_leden gl WHERE gl.groep_id = entries_groepen.groep_id AND gl.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "entries_groepen_insert_eigen_melding_lid" ON entries_groepen
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entries_groepen.entry_id AND e.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM groep_leden gl WHERE gl.groep_id = entries_groepen.groep_id AND gl.user_id = auth.uid())
  );

CREATE POLICY "entries_groepen_delete_eigen_melding" ON entries_groepen
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entries_groepen.entry_id AND e.user_id = auth.uid())
  );

-- entries: ADDITIONELE select-policy (naast die uit migratie 0011, niet
-- vervangen — Postgres OR't permissive policies voor dezelfde
-- operatie samen) — een melding die met een groep gedeeld is, is zichtbaar
-- voor elk lid van die groep. Hoeveel velden de UI daadwerkelijk toont is
-- client-side, trust-tier-afhankelijk (zie src/lib/groepen/trustZichtbaarheid.js).
CREATE POLICY "entries_select_groepslid" ON entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM entries_groepen eg
      JOIN groep_leden gl ON gl.groep_id = eg.groep_id
      WHERE eg.entry_id = entries.id AND gl.user_id = auth.uid()
    )
  );

-- ============================================================
-- Functies (SECURITY DEFINER) — zelfde patroon als
-- verbruik_coordinatie_token (migratie 0007): smal, specifiek doel,
-- bypassen de afwezige INSERT/UPDATE/DELETE-policies op groep_leden.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_groep_aanmaken(p_naam text, p_beschrijving text, p_openbaar boolean, p_max_beheerders integer)
RETURNS uuid AS $$
DECLARE
  nieuwe_groep_id uuid;
BEGIN
  INSERT INTO groepen (naam, beschrijving, openbaar, max_beheerders, hoofdbeheerder_id)
  VALUES (p_naam, p_beschrijving, COALESCE(p_openbaar, false), COALESCE(p_max_beheerders, 1), auth.uid())
  RETURNING id INTO nieuwe_groep_id;

  INSERT INTO groep_leden (groep_id, user_id, rol)
  VALUES (nieuwe_groep_id, auth.uid(), 'hoofdbeheerder');

  RETURN nieuwe_groep_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_groep_aanmaken(text, text, boolean, integer) TO authenticated;

-- Direct lid worden van een OPENBARE groep, zonder uitnodiging (sectie 6:
-- "kunnen zonder uitnodiging gevonden worden"). Geen goedkeuringsstap —
-- de spec noemt dat optioneel ("kan afhankelijk zijn van"), niet verplicht;
-- een latere goedkeuringsworkflow kan hier los op gebouwd worden zonder
-- deze functie te breken.
CREATE OR REPLACE FUNCTION fn_groep_openbaar_lid_worden(p_groep_id uuid)
RETURNS boolean AS $$
DECLARE
  is_openbaar boolean;
BEGIN
  SELECT openbaar INTO is_openbaar FROM groepen WHERE id = p_groep_id;
  IF is_openbaar IS NOT TRUE THEN
    RETURN false;
  END IF;

  INSERT INTO groep_leden (groep_id, user_id, rol)
  VALUES (p_groep_id, auth.uid(), 'lid')
  ON CONFLICT (groep_id, user_id) DO NOTHING;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_groep_openbaar_lid_worden(uuid) TO authenticated;

-- Valideert expiry/intrekking/gebruikslimiet en voegt de aanroeper toe als
-- 'lid'. Retourneert de groep_id bij succes, NULL als de uitnodiging
-- ongeldig is (verlopen/ingetrokken/vol).
CREATE OR REPLACE FUNCTION fn_groep_uitnodiging_accepteren(p_token text)
RETURNS uuid AS $$
DECLARE
  uitnodiging record;
BEGIN
  SELECT * INTO uitnodiging
  FROM groep_uitnodigingen
  WHERE token = p_token
  FOR UPDATE;

  IF uitnodiging IS NULL THEN
    RETURN NULL;
  END IF;

  IF uitnodiging.ingetrokken
     OR uitnodiging.verloopt_op <= now()
     OR uitnodiging.gebruikt_aantal >= uitnodiging.max_gebruikers THEN
    RETURN NULL;
  END IF;

  INSERT INTO groep_leden (groep_id, user_id, rol)
  VALUES (uitnodiging.groep_id, auth.uid(), 'lid')
  ON CONFLICT (groep_id, user_id) DO NOTHING;

  UPDATE groep_uitnodigingen
  SET gebruikt_aantal = gebruikt_aantal + 1
  WHERE id = uitnodiging.id;

  RETURN uitnodiging.groep_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_groep_uitnodiging_accepteren(text) TO authenticated;

-- Publiek aanroepbaar (ook zonder account, zelfde reden als
-- publieke_buurt_telling) — telt alleen hoe vaak een uitnodigingslink
-- geopend is, voor de statistieken op de groepspagina van de beheerder.
-- Geen Notification-API/push (bewust verwijderd uit de app, zie
-- DECISIONS.md "Buurt-notificaties verwijderd") — de beheerder ziet dit
-- alleen als hij zelf de groepspagina opent.
CREATE OR REPLACE FUNCTION fn_groep_uitnodiging_geopend(p_token text)
RETURNS void AS $$
  UPDATE groep_uitnodigingen
  SET keer_geopend = keer_geopend + 1
  WHERE token = p_token AND ingetrokken = false AND verloopt_op > now();
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_groep_uitnodiging_geopend(text) TO anon, authenticated;

-- Alleen de hoofdbeheerder mag rollen wijzigen; bewaakt max_beheerders.
-- Wijzigt nooit naar/van 'hoofdbeheerder' (die overdracht is bewust geen
-- onderdeel van deze opdracht).
CREATE OR REPLACE FUNCTION fn_groep_rol_wijzigen(p_groep_id uuid, p_target_user_id uuid, p_nieuwe_rol text)
RETURNS boolean AS $$
DECLARE
  is_hoofdbeheerder boolean;
  max_beheerders_toegestaan integer;
  huidig_aantal_beheerders integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM groepen WHERE id = p_groep_id AND hoofdbeheerder_id = auth.uid()
  ) INTO is_hoofdbeheerder;

  IF NOT is_hoofdbeheerder OR p_nieuwe_rol NOT IN ('lid', 'beheerder') THEN
    RETURN false;
  END IF;

  IF p_nieuwe_rol = 'beheerder' THEN
    SELECT max_beheerders INTO max_beheerders_toegestaan FROM groepen WHERE id = p_groep_id;
    SELECT count(*) INTO huidig_aantal_beheerders
    FROM groep_leden WHERE groep_id = p_groep_id AND rol = 'beheerder';

    IF huidig_aantal_beheerders >= max_beheerders_toegestaan THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE groep_leden SET rol = p_nieuwe_rol
  WHERE groep_id = p_groep_id AND user_id = p_target_user_id AND rol <> 'hoofdbeheerder';

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_groep_rol_wijzigen(uuid, uuid, text) TO authenticated;

-- Door beheerder/hoofdbeheerder, OF een lid dat zichzelf verwijdert (groep
-- verlaten) — verwijdert in beide gevallen nooit de hoofdbeheerder zelf
-- (die moet eerst de rol overdragen, buiten de scope van deze opdracht).
CREATE OR REPLACE FUNCTION fn_groep_lid_verwijderen(p_groep_id uuid, p_target_user_id uuid)
RETURNS boolean AS $$
DECLARE
  mag_verwijderen boolean;
BEGIN
  SELECT (
    auth.uid() = p_target_user_id
    OR EXISTS (
      SELECT 1 FROM groep_leden
      WHERE groep_id = p_groep_id AND user_id = auth.uid() AND rol IN ('beheerder', 'hoofdbeheerder')
    )
  ) INTO mag_verwijderen;

  IF NOT mag_verwijderen THEN
    RETURN false;
  END IF;

  DELETE FROM groep_leden
  WHERE groep_id = p_groep_id AND user_id = p_target_user_id AND rol <> 'hoofdbeheerder';

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_groep_lid_verwijderen(uuid, uuid) TO authenticated;

-- Trust-score wijzigen, beperkt tot leden van de EIGEN groep — bewust geen
-- globale admin-functie (dat is zetTrustScoreAdmin() in migratie 0002/
-- src/lib/supabase/admin.js, blijft ongewijzigd voor CoördinatiePage).
CREATE OR REPLACE FUNCTION fn_groep_trust_score_wijzigen(p_groep_id uuid, p_target_user_id uuid, p_nieuwe_score integer)
RETURNS boolean AS $$
DECLARE
  mag_wijzigen boolean;
BEGIN
  SELECT (
    EXISTS (
      SELECT 1 FROM groep_leden
      WHERE groep_id = p_groep_id AND user_id = auth.uid() AND rol IN ('beheerder', 'hoofdbeheerder')
    )
    AND EXISTS (
      SELECT 1 FROM groep_leden
      WHERE groep_id = p_groep_id AND user_id = p_target_user_id
    )
  ) INTO mag_wijzigen;

  IF NOT mag_wijzigen THEN
    RETURN false;
  END IF;

  UPDATE user_profiles
  SET trust_score = GREATEST(0, LEAST(100, p_nieuwe_score))
  WHERE id = p_target_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_groep_trust_score_wijzigen(uuid, uuid, integer) TO authenticated;
