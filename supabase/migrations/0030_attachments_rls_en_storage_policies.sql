-- Migratie 0030: RLS op attachments-tabel + Storage bucket policies
-- voor admin/coordinator/groepslid-met-hoge-trust bijlagen-toegang.
--
-- Probleem: de attachments-tabel heeft geen RLS-policies (nooit in een
-- migratie gedefinieerd). Storage-bucket spuitlog-bijlagen heeft ook geen
-- expliciete policies. Hierdoor:
--   - Admins/coordinators die een dossier-export of buurtgebied-export
--     doen kunnen geen andermans bijlagen ophalen.
--   - Groepsleden met trust-tier "hoog" (score >= 80) kunnen geen foto's
--     zien van gedeelde groepsmeldingen van andere melders.
--   - Er is geen beveiliging dat uploads alleen naar het eigen pad mogen.
--
-- Trust-tiers (uit trustZichtbaarheid.js, migratie 0014):
--   laag      0 - 39   geen foto's
--   gemiddeld 40 - 79  geen foto's
--   hoog      80 - 100 foto's zichtbaar
--
-- Storage-pad structuur: {user_id}/{entry_id}/{hash}_{filename}
--   storage.foldername(name)[1] = user_id (tekst)
--   storage.foldername(name)[2] = entry_id (tekst, DL-... formaat)
--
-- Gerelateerde migraties:
--   0029 — fn_entry_zichtbaar_voor_groepslid() (SECURITY DEFINER,
--           gebruikt in STAP 1 hieronder)

-- ──────────────────────────────────────────────────────────
-- STAP 1: hulpfunctie voor groepslid + trust-check
-- ──────────────────────────────────────────────────────────
-- Combineert fn_entry_zichtbaar_voor_groepslid() (migratie 0029) met
-- een trust_score-check. Draait als SECURITY DEFINER zodat de interne
-- queries op entries_groepen, groep_leden en user_profiles geen RLS-
-- rekursie kunnen veroorzaken.
CREATE OR REPLACE FUNCTION fn_bijlage_leesbaar_voor_groepslid(
  p_entry_id text,
  p_user_id  uuid
) RETURNS boolean AS $$
  SELECT
    fn_entry_zichtbaar_voor_groepslid(p_entry_id, p_user_id)
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = p_user_id AND trust_score >= 80
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION fn_bijlage_leesbaar_voor_groepslid(text, uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- STAP 2: RLS op de attachments-tabel
-- ──────────────────────────────────────────────────────────
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: eigen bijlagen
DROP POLICY IF EXISTS "attachments_select_eigen" ON attachments;
CREATE POLICY "attachments_select_eigen" ON attachments
  FOR SELECT USING (user_id = auth.uid());

-- SELECT: admin of coordinator (dossier-export, buurtgebied-bundel)
DROP POLICY IF EXISTS "attachments_select_admin_coordinator" ON attachments;
CREATE POLICY "attachments_select_admin_coordinator" ON attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'coordinator')
    )
  );

-- SELECT: groepslid met trust-tier "hoog" voor gedeelde groepsmeldingen
DROP POLICY IF EXISTS "attachments_select_groepslid_hoog" ON attachments;
CREATE POLICY "attachments_select_groepslid_hoog" ON attachments
  FOR SELECT USING (
    fn_bijlage_leesbaar_voor_groepslid(entry_id, auth.uid())
  );

-- INSERT: alleen naar eigen entry (user_id moet overeenkomen)
DROP POLICY IF EXISTS "attachments_insert_eigen" ON attachments;
CREATE POLICY "attachments_insert_eigen" ON attachments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: eigen bijlagen bijwerken (bijv. storage_path invullen na upload)
DROP POLICY IF EXISTS "attachments_update_eigen" ON attachments;
CREATE POLICY "attachments_update_eigen" ON attachments
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: eigen bijlagen; admin mag ook andermans bijlagen verwijderen
DROP POLICY IF EXISTS "attachments_delete_eigen_of_admin" ON attachments;
CREATE POLICY "attachments_delete_eigen_of_admin" ON attachments
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────
-- STAP 3: Storage bucket spuitlog-bijlagen
--   pad: {user_id}/{entry_id}/{hash}_{filename}
-- ──────────────────────────────────────────────────────────

-- INSERT: upload alleen naar eigen uid-map
DROP POLICY IF EXISTS "spuitlog_bijlagen_insert_eigen" ON storage.objects;
CREATE POLICY "spuitlog_bijlagen_insert_eigen"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'spuitlog-bijlagen'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: upsert bij herhaling van dezelfde upload (upsert:true in code)
DROP POLICY IF EXISTS "spuitlog_bijlagen_update_eigen" ON storage.objects;
CREATE POLICY "spuitlog_bijlagen_update_eigen"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'spuitlog-bijlagen'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT / signed URL: eigen bestanden
DROP POLICY IF EXISTS "spuitlog_bijlagen_select_eigen" ON storage.objects;
CREATE POLICY "spuitlog_bijlagen_select_eigen"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'spuitlog-bijlagen'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT / signed URL: admin of coordinator (dossier-export, buurtgebied)
DROP POLICY IF EXISTS "spuitlog_bijlagen_select_admin_coordinator" ON storage.objects;
CREATE POLICY "spuitlog_bijlagen_select_admin_coordinator"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'spuitlog-bijlagen'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'coordinator')
    )
  );

-- SELECT / signed URL: groepslid met hoge trust (score >= 80)
-- Tweede map-component in het pad is de entry_id (DL-... formaat)
DROP POLICY IF EXISTS "spuitlog_bijlagen_select_groepslid_hoog" ON storage.objects;
CREATE POLICY "spuitlog_bijlagen_select_groepslid_hoog"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'spuitlog-bijlagen'
    AND fn_bijlage_leesbaar_voor_groepslid(
      (storage.foldername(name))[2],
      auth.uid()
    )
  );

-- DELETE: eigen bestanden
DROP POLICY IF EXISTS "spuitlog_bijlagen_delete_eigen" ON storage.objects;
CREATE POLICY "spuitlog_bijlagen_delete_eigen"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'spuitlog-bijlagen'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
