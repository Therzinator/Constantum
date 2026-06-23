-- Bugfix: "infinite recursion detected in policy for relation
-- groep_leden" — de SELECT-policy op groep_leden (migratie 0015)
-- controleerde lidmaatschap met een EXISTS-subquery op groep_leden ZELF:
--   EXISTS (SELECT 1 FROM groep_leden gl2 WHERE gl2.groep_id = ... )
-- Elke rij-toegang tot groep_leden evalueert deze policy, die zelf weer
-- een SELECT op groep_leden doet, die de policy opnieuw evalueert — een
-- oneindige lus. Andere tabellen (groepen, groep_uitnodigingen,
-- entries_groepen, entries) die groep_leden bevragen in hún policies
-- liepen hier ook tegenaan, want die triggeren dezelfde kapotte policy.
--
-- Fix: lidmaatschap controleren via een SECURITY DEFINER-functie i.p.v.
-- een inline subquery — die functie draait met de rechten van de
-- functie-eigenaar (bypasst RLS), dus de SELECT erbinnen triggert de
-- policy niet opnieuw. Zelfde patroon als de overige fn_groep_*-functies.
--
-- Handmatig uitvoeren in de Supabase SQL-editor (geen migratie-tooling in
-- dit project — zie root-CLAUDE.md "Database-schema (Supabase)").

CREATE OR REPLACE FUNCTION fn_is_groepslid(p_groep_id uuid, p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM groep_leden WHERE groep_id = p_groep_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION fn_is_groepslid(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "groep_leden_select_eigen_of_groepslid_of_admin" ON groep_leden;
CREATE POLICY "groep_leden_select_eigen_of_groepslid_of_admin" ON groep_leden
  FOR SELECT USING (
    user_id = auth.uid()
    OR fn_is_groepslid(groep_id, auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
