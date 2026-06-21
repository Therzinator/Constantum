# Volgende stappen — SpuitLogger

Alleen openstaande werkzaamheden. Afgeronde taken hier verwijderen, niet
laten staan met een ✅. Bij twijfel of iets nog open is: verifiëren tegen
de code, niet tegen het geheugen van een eerdere sessie.

## Hoog

- **Een gebruiker een `coordinator`-rol toekennen om te testen.** Reden:
  migraties 0008-0011 zijn op 2026-06-21 uitgevoerd (bevestigd, geen
  foutmeldingen), maar er is nog geen account met de rol `coordinator`;
  `user_roles.role = 'coordinator'` moet handmatig gezet worden (geen UI
  hiervoor) om de CoördinatiePage-toegang/Heatmap-toggle te verifiëren.

## Middel

- **Paginering/incrementele sync van `laadVanSupabase()` — NIET zonder
  schema-verificatie.** Reden: de functie doet een ongelimiteerde
  `.select('*')` op elke sync (lib/supabase/entries.js regel 82-87) —
  bij een drukke buurt groeit dit ongebreideld. Een incrementele aanpak
  (alleen `entries` ophalen die nieuwer zijn dan de laatste sync) is de
  juiste oplossing, maar vereist een betrouwbaar bijgehouden `updated_at`-
  kolom die ook bij een `UPDATE` (niet alleen INSERT) verandert — die
  kolom staat in geen enkele migratie (0001-0011) aangemaakt of
  getriggerd, en kan dus niet vanuit de code geverifieerd worden. Eerst in
  de Supabase SQL-editor controleren of `entries.updated_at` bestaat én
  automatisch bijgewerkt wordt (trigger), vóórdat hier iets aan
  veranderd wordt — een foute aanname hier riskeert een stille
  sync-regressie (oudere meldingen die niet meer meekomen).
- **Productie-foutregistratie (bv. Sentry).** Reden: 56+ console.log/warn/
  error-aanroepen, geen enkele zichtbaarheid op productiefouten bij
  duizenden gebruikers. Niet door een agent zelfstandig af te ronden:
  vereist een account/DSN bij een externe dienst, dus een keuze die de
  gebruiker zelf moet maken (welke dienst, welk privacybeleid t.o.v. de
  AVG-gevoelige aard van deze app).
- **API-niveau rate limiting tegen volumetrisch misbruik.** Reden: de
  huidige misbruikdetectie (migraties 0003/0005) is reactief (markeert
  achteraf als under_review/shadow), niet preventief. Vereist een
  Supabase Edge Function-deploy — operationele actie die de gebruiker
  zelf moet doen, een agent kan dit niet namens hen uitvoeren.
- **`useToggleableLayer()`-hook voor DashboardKaart.jsx.** De vijf
  laag-toggle-functies (luchtfoto/drift/Natura2000/percelen/heatmap) zijn
  structureel bijna identiek. De PDOK-fetch-duplicatie is al opgelost
  (`lib/pdok/wfsClient.js`, 2026-06-21) — deze hook-generalisatie is
  bewust nog niet gedaan: hogere kans op een subtiele regressie in een
  component die al 594 regels is, zonder browser-test niet veilig te
  verifiëren binnen deze sessie.

## Laag

- **CHECK-constraint of enum op `user_roles.role` overwegen.** Reden: nu
  faalt een typo in de rolwaarde stil naar `'gebruiker'`-gedrag, zonder
  signaal. Geen acute pijn, wel een potentiële stille bug.
  Afhankelijkheden: nieuwe SQL-migratie; alleen zinvol als het rolmodel
  verder uitgebreid wordt (zie punt hierboven).
