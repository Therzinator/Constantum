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