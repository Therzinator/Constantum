-- Coordinatie & Admin systeem, Fase 6/7 — buurtrapport + collectief
-- dossier. Handmatig uitvoeren in de Supabase SQL-editor.
--
-- buurtdossiers en coordinatie_tokens (migratie 0002) hadden nog GEEN
-- RLS aanstaan — zonder RLS is een tabel standaard volledig leesbaar/
-- schrijfbaar voor elke rol die op de tabel mag connecten. Dit zet RLS
-- aan en beperkt beide tot admins (coordinatie_tokens: ook de eigenaar
-- zelf, voor als de deeltoken-functionaliteit later wordt uitgewerkt —
-- de functionele invulling daarvan staat nog open, zie Fase 3).
ALTER TABLE buurtdossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buurtdossiers_admin_only" ON buurtdossiers;
CREATE POLICY "buurtdossiers_admin_only" ON buurtdossiers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE coordinatie_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coordinatie_tokens_eigen_of_admin" ON coordinatie_tokens;
CREATE POLICY "coordinatie_tokens_eigen_of_admin" ON coordinatie_tokens
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
