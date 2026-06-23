-- Feedback-paneel — bewoners kunnen technische problemen (bugs) melden of
-- vragen/opmerkingen/complimenten insturen, bereikbaar via Instellingen.
-- Twee categorieën met verschillend zichtbaarheidsmodel (bevestigd
-- ontwerp 2026-06-23):
--   - 'technisch'  — PUBLIEK zichtbaar voor alle ingelogde gebruikers
--     (gedeelde bugtracker-achtige transparantie, voorkomt dubbele
--     meldingen van hetzelfde probleem).
--   - 'vraag'      — alleen zichtbaar voor de melder zelf en de admin
--     (vragen/opmerkingen/complimenten zijn niet publiek).
-- Status: onbehandeld (rood, standaard) -> in_behandeling (geel) ->
-- afgehandeld (groen). Alleen 'admin' mag status/reactie wijzigen — geen
-- coordinator-uitbreiding hier, expliciet door de gebruiker als
-- "admin"-taak benoemd (anders dan de meeste CoördinatiePage-taken).
--
-- Handmatig uitvoeren in de Supabase SQL-editor (geen migratie-tooling in
-- dit project — zie root-CLAUDE.md "Database-schema (Supabase)").

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('technisch', 'vraag')),
  titel text NOT NULL,
  omschrijving text NOT NULL,
  context text,
  app_version text,
  status text NOT NULL DEFAULT 'onbehandeld' CHECK (status IN ('onbehandeld', 'in_behandeling', 'afgehandeld')),
  admin_reactie text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Select: technische meldingen zijn voor iedereen die is ingelogd
-- zichtbaar; vragen/opmerkingen alleen voor de melder zelf of een admin.
CREATE POLICY "feedback_select_technisch_of_eigen_of_admin" ON feedback
  FOR SELECT USING (
    type = 'technisch'
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insert: iedere ingelogde gebruiker, alleen voor zichzelf.
CREATE POLICY "feedback_insert_eigen" ON feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Update: uitsluitend admin (status/admin_reactie wijzigen) — een
-- gewone gebruiker kan zijn eigen melding niet achteraf aanpassen.
CREATE POLICY "feedback_update_admin" ON feedback
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- updated_at automatisch bijhouden bij elke admin-wijziging (status/reactie).
CREATE OR REPLACE FUNCTION fn_feedback_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feedback_updated_at ON feedback;
CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION fn_feedback_updated_at();
