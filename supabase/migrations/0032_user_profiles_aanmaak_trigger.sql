-- Migratie 0032: aanmaak-trigger user_profiles + backfill bestaande gebruikers
--
-- Probleem: user_profiles heeft 0 rijen omdat er nooit een trigger was die
-- automatisch een rij aanmaakt wanneer een gebruiker zich registreert.
-- Gevolg: trust-score badges, trust-score-verdeling en alle functies die
-- user_profiles.trust_score lezen geven geen data terug.
--
-- Oplossing:
-- 1. Trigger op auth.users → INSERT creëert automatisch een user_profiles rij.
-- 2. Backfill van bestaande auth.users die nog geen profiel hebben.

-- Functie die bij elke nieuwe Supabase-gebruiker een profiel aanmaakt
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger op auth.users (Supabase ingebouwde auth-tabel)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- Backfill: maak profielen aan voor alle bestaande gebruikers die er nog geen hebben
INSERT INTO public.user_profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;
