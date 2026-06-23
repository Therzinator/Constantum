# Volgende stappen — SpuitLogger

Alleen openstaande werkzaamheden. Afgeronde taken hier verwijderen, niet
laten staan met een ✅. Bij twijfel of iets nog open is: verifiëren tegen
de code, niet tegen het geheugen van een eerdere sessie.

## Hoog

- **Migratie 0015 (Groepenfunctie) uitvoeren in de Supabase SQL-editor.**
  Nieuw schema (`groepen`/`groep_leden`/`groep_uitnodigingen`/
  `entries_groepen`) + RLS + SECURITY DEFINER-functies, zie
  `supabase/migrations/0015_groepen.sql`. De nieuwe Groepen-pagina/-tab is
  al in de app gebouwd en gekoppeld, maar werkt zonder deze migratie niet
  (tabellen bestaan dan nog niet). Migratie 0015 leest óók
  `user_profiles.trust_score` voor de trust-tier-gestuurde zichtbaarheid
  binnen een groep — werkt los van migratie 0014, maar voor de bedoelde
  tier-indeling (zie CURRENT_STATE.md) moet 0014 ook uitgevoerd zijn.
- **Icon_*.png-bestanden (`src/assets/ui-icons/`) waren oorspronkelijk
  RGB zonder alphakanaal — gerepareerd door alpha af te leiden uit
  pixelhelderheid (achtergrond zwart -> transparant), zodat de bestaande
  currentColor-mask-techniek (BottomNav.jsx) ze als lijn-iconen i.p.v.
  effen blokken toont. Als er ooit nieuwe `icon_*`-bestanden aangeleverd
  worden: controleer eerst of ze wél een alphakanaal hebben (PNG color
  type 6), anders is dezelfde fix opnieuw nodig.
- **Controleren of een coordinator/admin andermans foto's mag lezen
  (attachments-tabel + storage-bucket `spuitlog-bijlagen`-RLS).** Nodig
  voor de nieuwe "Exporteer meldingen + Dossier-PDF" op Buurtgebied
  tekenen (CoordinatiePage) — die bundelt foto's van ALLE melders binnen
  het getekende gebied, niet alleen eigen meldingen. Niet vanuit de code
  te verifiëren: geen migratie regelt RLS op `attachments`/storage. Werkt
  ook zonder (faalt stilletjes terug naar geen foto's per melding), maar
  check of dat het gewenste gedrag is.
- **Provincie/gemeente backfillen-knop draaien op CoordinatiePage.**
  Migratie 0013 (`gemeente`/`provincie`-kolommen op `entries`) is
  **uitgevoerd** (bevestigd door de gebruiker op 2026-06-22) — nieuwe
  meldingen krijgen deze velden nu automatisch. Historische meldingen
  missen ze nog; eenmalig aanvullen via de backfill-knop in de
  "Filter op provincie/gemeente"-kaart.
- **Migratie 0014 (trust-score automatische op-/afschaling) uitvoeren in
  de Supabase SQL-editor.** Ontwerp + concrete getallen zijn op
  2026-06-22 bevestigd en uitgewerkt
  (`supabase/migrations/0014_trust_score_op_afschaling.sql`, zie
  CURRENT_STATE.md). Tot uitvoering blijft het oude <40-shadow-gedrag uit
  migratie 0005 actief. Na uitvoering: overwegen of de kwartaalbonus-
  functie via `pg_cron` gepland wordt of handmatig per kwartaal gedraaid
  (zie commentaarblok in de migratie).

- **Een gebruiker een `coordinator`-rol toekennen om te testen.** Reden:
  migraties 0008-0011 zijn op 2026-06-21 uitgevoerd (bevestigd, geen
  foutmeldingen), maar er is nog geen account met de rol `coordinator`;
  `user_roles.role = 'coordinator'` moet handmatig gezet worden (geen UI
  hiervoor) om de CoördinatiePage-toegang/Heatmap-toggle te verifiëren.

## Middel

- **Verdampings-/blootstellingsrisico-indicator uitwerken — eerst
  vuistregels afstemmen, dan pas bouwen.** Reden: het driftzone-model
  (FOCUS STEP) gaat bewust uit van "geen driftreductie" als worst-case
  voor spuitdop-afhankelijkheid — dat is al expliciet gecommuniceerd in
  de UI (`DriftZoneModal.jsx`) en verdedigbaar. Het echte gat is
  verdamping: `melding.weather.temperature` wordt al opgehaald (Open-
  Meteo) maar nergens analytisch gebruikt; de enige verdampings-logica is
  één losse RV>85%-drempel in `lib/meldingen/spuitpatroon.js`; de al
  berekende Pasquill-stabiliteitsklasse (`lib/weather/pasquill.js`,
  relevant omdat stabiele klassen E/F damp dicht bij de grond houden)
  wordt alleen als label getoond, niet gecombineerd tot een risico-
  indicator. Data is er al, ontbrekend is de samengevoegde regel-
  gebaseerde indicator (zelfde stijl als `spuitpatroon.js`). Eerst
  uitzoeken welke temperatuur/RV/Pasquill-drempels het meest
  verdedigbaar zijn (geen vastgestelde norm zoals bij windsnelheid),
  vóórdat dit gebouwd wordt.
- **Dode code opruimen: `lib/drift/berekening.js`.** Gevonden tijdens het
  bovenstaande onderzoek — dit bestand is een volledige duplicaat van de
  driftzone-logica in `lib/drift/driftzone.js` (FOCUS_DRIFT_TABEL/
  focusDriftPct/windFactor/driftZones/driftKegel), maar wordt nergens
  geïmporteerd. Losse, lage-risico opruimtaak.
- **Realtime-subscriptie opnieuw filteren — NIET zonder live Supabase-test.**
  Reden: op 2026-06-21 toegevoegde `filter`-optie op de postgres_changes-
  listener (user_id/opt_in_buurt, voor minder Realtime-verkeer) is
  teruggedraaid naar een eenvoudige ongefilterde listener nadat de app bij
  de eerste echte login bevroor. Achteraf bleek de freeze NIET door de
  filter te komen, maar door een aparte, echte bug in `useAuth.js` (zie
  DECISIONS.md) — de filter-revert was dus voorbarig, maar wel veilig om
  te laten staan. Als dit alsnog opnieuw opgepakt wordt: eerst tegen een
  echte Supabase-omgeving testen, niet alleen op localhost (waar
  SUPABASE_ENABLED altijd false is, dus deze code daar nooit draait) —
  zie hooks/useSupabaseSync.js.
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
