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
  De CHECK-constraint (migratie 0026) staat en laat `'coordinator'` toe.
- **Icon_*.png-bestanden (`src/assets/ui-icons/`) waren oorspronkelijk
  RGB zonder alphakanaal — gerepareerd door alpha af te leiden uit
  pixelhelderheid (achtergrond zwart -> transparant), zodat de bestaande
  currentColor-mask-techniek (BottomNav.jsx) ze als lijn-iconen i.p.v.
  effen blokken toont. Als er ooit nieuwe `icon_*`-bestanden aangeleverd
  worden: controleer eerst of ze wél een alphakanaal hebben (PNG color
  type 6), anders is dezelfde fix opnieuw nodig.
- **Migratie 0030 uitvoeren in Supabase SQL-editor** — regelt RLS op de
  `attachments`-tabel en Storage-policies voor de `spuitlog-bijlagen`-bucket.
  Daarna testen: als coordinator/admin een melding van een andere melder
  openen en controleren of foto's laden; als groepslid met score >= 80
  een groepsmelding van een ander openen en foto's controleren.
- **Provincie/gemeente backfillen-knop draaien op CoordinatiePage.**
  Migratie 0013 (`gemeente`/`provincie`-kolommen op `entries`) is
  uitgevoerd — nieuwe meldingen krijgen deze velden automatisch.
  Historische meldingen missen ze nog; eenmalig aanvullen via de
  backfill-knop in de "Filter op provincie/gemeente"-kaart.
  Rate limiting (200ms/aanroep) is per 2026-06-29 in orde; de knop
  kan nu ook voor grote backlogs veilig gedraaid worden.

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
