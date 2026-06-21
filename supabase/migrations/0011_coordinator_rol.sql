-- Coördinatie & Admin systeem — coordinator-rol toevoegen als
-- moderator-achtige rol naast admin. CoördinatiePage en de Heatmap-
-- toggle op het Dashboard staan al (client-side) ook open voor
-- role='coordinator' (zie src/lib/rollen.js, isCoordinatorOfAdmin()) —
-- zonder deze RLS-uitbreiding zou een coordinator op de pagina komen
-- maar alleen zijn eigen rijen terugkrijgen uit entries/user_profiles,
-- dus de UI zou leeg/kapot lijken.
--
-- Bewust NIET uitgebreid naar coordinator:
-- - user_profiles DELETE-policy (migratie 0008, "account verwijderen")
--   blijft admin-only — geen moderatie-taak.
-- - coordinatie_tokens-policy (migratie 0006) blijft admin-only — wordt
--   nu niet gebruikt door enige coordinator-functionaliteit.
--
-- Handmatig uitvoeren in de Supabase SQL-editor (geen migratie-tooling in
-- dit project — zie CLAUDE.md "Database-schema (Supabase)").

-- entries SELECT — vervangt de policy uit migratie 0009 (admin OF eigen OF
-- opt_in_buurt-binnen-5km), nu met coordinator gelijk aan admin (volledige
-- leestoegang, geen 5km-beperking voor coordinator/admin).
DROP POLICY IF EXISTS "entries_select_eigen_opt_in_radius_of_admin" ON entries;
CREATE POLICY "entries_select_eigen_opt_in_radius_of_admin_coord" ON entries
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'coordinator'))
    OR (
      opt_in_buurt = true
      AND entries.gps_lat IS NOT NULL AND entries.gps_lng IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.thuislocatie_lat IS NOT NULL
          AND ur.thuislocatie_lng IS NOT NULL
          AND (
            6371000 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians(ur.thuislocatie_lat)) * cos(radians(entries.gps_lat)) *
                cos(radians(entries.gps_lng) - radians(ur.thuislocatie_lng)) +
                sin(radians(ur.thuislocatie_lat)) * sin(radians(entries.gps_lat))
              ))
            )
          ) <= 5000
      )
    )
  );

-- entries UPDATE — nodig voor zetVisibilityAdmin() (modereren) en
-- zetPostcodeAdmin() (datakwaliteit), beide onderdeel van CoördinatiePage.
DROP POLICY IF EXISTS "entries_update_eigen_of_admin" ON entries;
CREATE POLICY "entries_update_eigen_of_admin_coord" ON entries
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'coordinator'))
  );

-- user_profiles SELECT — nodig om het melder-overzicht/trust-score-
-- verdeling te kunnen tonen.
DROP POLICY IF EXISTS "user_profiles_select_eigen_of_admin" ON user_profiles;
CREATE POLICY "user_profiles_select_eigen_of_admin_coord" ON user_profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'coordinator'))
  );

-- user_profiles UPDATE — nodig voor zetTrustScoreAdmin().
DROP POLICY IF EXISTS "user_profiles_update_eigen_of_admin" ON user_profiles;
CREATE POLICY "user_profiles_update_eigen_of_admin_coord" ON user_profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'coordinator'))
  );

-- buurtdossiers — nodig voor BuurtrapportGenerator (maakBuurtdossier/
-- haalBuurtdossiers), onderdeel van de "datakwaliteit & rapportage"-taken.
DROP POLICY IF EXISTS "buurtdossiers_admin_only" ON buurtdossiers;
CREATE POLICY "buurtdossiers_admin_of_coord" ON buurtdossiers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'coordinator'))
  );
