-- Groepsuitnodigingen verwijderen — migratie 0015 had alleen SELECT/
-- INSERT/UPDATE-policies op groep_uitnodigingen (intrekken was al mogelijk
-- via UPDATE), maar geen DELETE. Op verzoek (2026-06-24): de
-- beheerder/hoofdbeheerder van de groep (of een admin) mag een
-- uitnodiging definitief verwijderen, zodat de lijst met
-- ingetrokken/verlopen uitnodigingen niet blijft ophopen. Zonder deze
-- migratie faalt elke verwijderpoging stil op RLS, net als migratie 0019
-- voor feedback.
--
-- Handmatig uitvoeren in de Supabase SQL-editor (geen migratie-tooling in
-- dit project — zie root-CLAUDE.md "Database-schema (Supabase)").

CREATE POLICY "groep_uitnodigingen_delete_beheerder_of_admin" ON groep_uitnodigingen
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groep_leden gl
      WHERE gl.groep_id = groep_uitnodigingen.groep_id AND gl.user_id = auth.uid() AND gl.rol IN ('beheerder', 'hoofdbeheerder')
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
