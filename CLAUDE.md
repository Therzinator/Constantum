# SpuitLogger

## Project context
SpuitLogger is een GIS-webapp voor het registreren van bestrijdingsmiddelen-spuitactiviteit 
near residential areas in Nederland. Doel: juridisch bewijsmateriaal genereren voor burgers.

## Technische stack
- Frontend: React (Vite)
- Backend: Supabase
- Cryptografie: SHA-256, RFC 3161, eIDAS
- APIs: PDOK, BRP, BAG

## Regels voor agents
- Raak SHA-256 en RFC 3161 logica NIET aan zonder expliciete bevestiging
- Gebruik Nederlandse namen voor domeinlogica (perceel, spuitdatum, melding, etc.)
- PDOK/BAG/BRP koppelingen zijn bestaande integraties — niet refactoren zonder toestemming
- Sla altijd op in Git voordat je grote wijzigingen maakt

## Database-schema (Supabase)
Er is geen migratie-tooling gekoppeld aan dit project — Supabase-schema wordt
handmatig beheerd via de SQL-editor. Schema-wijzigingen worden wel altijd als
SQL-bestand vastgelegd in `supabase/migrations/NNNN_korte_naam.sql` (oplopend
genummerd), zodat ze reproduceerbaar en review-baar blijven, ook al worden ze
niet automatisch uitgevoerd. Voeg in het bestand een commentaarblok toe met
eventuele bijbehorende RLS-policy-wijzigingen. Voer het bestand zelf uit in de
Supabase SQL-editor — een agent kan dit niet namens je uitvoeren.