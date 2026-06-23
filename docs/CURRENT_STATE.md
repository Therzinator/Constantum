# Huidige staat — SpuitLogger

Momentopname. Dit bestand veroudert sneller dan DOMAIN_KNOWLEDGE.md/
DECISIONS.md — bij twijfel altijd verifiëren tegen de code (`git log`,
grep), niet blind vertrouwen op een oude snapshot.

Laatst bijgewerkt: 2026-06-23.

## Technische stack

- **Frontend**: React 19 + Vite 8, geen TypeScript.
- **Backend**: Supabase (Postgres + Auth + Storage), schema handmatig
  beheerd (zie DECISIONS.md).
- **Kaart**: OpenLayers 10 + proj4 (RD New-reprojectie voor PDOK-WFS).
- **Grafieken**: Chart.js.
- **Cryptografie**: SHA-256 + RFC 3161-tijdstempel + eIDAS (freeze-zone,
  zie DECISIONS.md) — voor dossier-PDF's.
- **Externe API's**: PDOK (kadastrale percelen, Natura2000, postcode,
  BAG/woninglocaties), Open-Meteo (live weer), KNMI Open Data EDR
  (gecertificeerd weer), BRP (volgens root-CLAUDE.md aanwezig, niet
  vandaag bekeken).
- **Testen**: ESLint, Playwright (`npm run test:e2e`), `npm run build` als
  rooktest (geen unit-testrunner geconfigureerd in `package.json`).

## Buurtgebied tekenen → export + Dossier-PDF (sinds 2026-06-22)

- **Kaart toont nu meldingen geclusterd** (`BuurtgebiedTekenaar.jsx`,
  zelfde `ol/source/Cluster`-patroon als `DashboardKaart.jsx`, maar
  vereenvoudigd — geen klik-popup/datumlabel, alleen kleur-per-type +
  aantal-badge) — voorheen een lege kaart, je tekende dus "blind". Toont
  de set die CoordinatiePage al doorgeeft (`entriesGefilterd`, dezelfde
  provincie/gemeente-filter als de andere kaarten). Kaarthoogte 240px →
  360px voor betere leesbaarheid van de clustering.
- **Na het tekenen: twee losse knoppen** — "📄 Exporteer meldingen als
  CSV" en "📦 Stel Dossier-PDF samen" zijn bewust gescheiden acties
  (voorheen één knop die altijd eerst de CSV downloadde en daarna de PDF
  opende). Beide filteren ALLE meldingen (volledig admin/coordinator-
  zicht via `haalAlleEntriesVoorExportAdmin()`, **ongeacht `opt_in_buurt`**
  — dit is bewust geen anonieme aggregatie zoals Buurtrapport genereren,
  maar het al bestaande admin-zicht op individuele meldingen) op of ze
  binnen de getekende polygoon liggen (`geometry.intersectsCoordinate()`,
  OpenLayers — geen eigen point-in-polygon-code) via de gedeelde helper
  `haalMeldingenInGebied()` (`BuurtgebiedTekenaar.jsx`, met eigen
  status/bezig-state per knop). De CSV-knop downloadt
  (`meldingenNaarCSV`); de PDF-knop bundelt in het bestaande
  Dossier-PDF-formaat (`genereerDossierHTML`/`openDossierPDF` uit
  `lib/export/pdf.js` — **ongewijzigd hergebruikt**, geen aanpassing aan
  hash/RFC3161-logica). Nieuw bestand `lib/meldingen/regioExport.js`
  (`entryNaarExportMelding()`) zet een ruwe entries-rij om naar dezelfde
  vorm die die PDF/CSV-functies al verwachten — een eigen, kleinere kopie
  van de mapping in `laadVanSupabase()` (entries.js), niet die functie
  zelf aangepast.
- **Onzekerheid, niet vanuit code te verifiëren**: foto's worden per
  melding apart opgehaald via `laadBijlagenVanSupabase()` — of een
  coordinator/admin ook andermans bijlagen mag lezen hangt af van
  RLS-policies op `attachments`/Storage-bucket `spuitlog-bijlagen`, die in
  **geen enkele migratie** staan (zelfde "schema-gat"-patroon als migratie
  0012's audit_log-kolommen). Faalt per melding stilletjes terug naar een
  lege bijlagenlijst (geen harde foutmelding) als dat niet mag — dus de
  PDF/CSV-export zelf werkt altijd, alleen mogelijk zonder foto's van
  andere melders. Checken in de Supabase dashboard of dit gewenst is.

## Provincie/gemeente-filter op Coördinatie (sinds 2026-06-22)

- **Nieuwe kolommen `entries.gemeente`/`entries.provincie`** (migratie
  0013, **uitgevoerd** — bevestigd door de gebruiker op 2026-06-22).
  Historische meldingen moeten nog via de backfill-knop op
  CoordinatiePage aangevuld worden, zie NEXT_STEPS.md. Gevuld via een
  nieuwe, additieve PDOK-functie
  `zoekGemeenteProvinciePDOK()` (`lib/pdok/postcode.js`) — bewust naast
  de bestaande `zoekPostcodePDOK()` gehouden i.p.v. samengevoegd, zie
  CLAUDE.md ("PDOK-koppelingen niet refactoren zonder toestemming").
  Wordt net als postcode ingevuld bij het plaatsen van de meldingspin
  (`useNieuweMeldingForm.js`) en heeft een eigen admin-backfill-knop op
  CoordinatiePage voor historische meldingen.
- **Filter op CoordinatiePage** (`provincies()`/`gemeentenInProvincie()`/
  `filterOpRegio()` in `lib/meldingen/coordinatieStatistieken.js`) — een
  provincie+gemeente-dropdown filtert Perceel-analyse, Windroos,
  Melder-overzicht en Onder review/shadow. Opt-in-melders-per-postcode en
  Trust-score-verdeling blijven bewust ongefilterd (niet gevraagd).
  Buurtgebied tekenen wordt bij het **eerste** openen van die kaart
  gecentreerd op het gemiddelde GPS-punt van de gefilterde meldingen (de
  kaart mount-eenmalig, zie `BuurtgebiedTekenaar.jsx` — een filter-wissel
  ná het tekenen verplaatst de kaart niet meer, bewust niet aangepast).
  Buurtrapport genereren krijgt het meest voorkomende postcodegebied
  binnen het filter voorgevuld (werkt zelf nog op postcode, niet op
  gemeente).
- Meldingen van vóór deze migratie/backfill missen gemeente/provincie en
  vallen buiten elk filter (blijven wel zichtbaar als er niet gefilterd
  wordt).

## Trust-score automatische op-/afschaling (sinds 2026-06-22, migratie 0014 — NOG NIET UITGEVOERD)

Ontwerp op 2026-06-22 met concrete getallen bevestigd door de gebruiker en
uitgewerkt in `supabase/migrations/0014_trust_score_op_afschaling.sql`.
**Nog niet uitgevoerd** door de gebruiker in de Supabase SQL-editor (zelfde
"handmatig uitvoeren"-patroon als alle migraties, zie root-CLAUDE.md) — tot
die uitvoering blijft `fn_entries_set_visibility()` op het oude <40-shadow-
gedrag staan zoals migratie 0005 het achterliet.

- **Categorieën** (`fn_entries_set_visibility()`, leest trust_score van
  vóór de insert): 80-100 "Vertrouwd" (geen nieuw-account-checks, altijd
  `normal`) · 40-79 "Standaard" (ongewijzigd bestaand gedrag: account <48u
  of <7 dagen + ≥5 meldingen/dag → `under_review`) · 20-39 "Verhoogd
  toezicht" (nieuw — élke nieuwe melding → `under_review`, los van
  account-leeftijd) · 0-19 "Geschaduwd" (drempel verlaagd van <40 naar
  <20 — bevestigd: bestaande gebruikers in de 20-39-band gaan hierdoor
  meteen van shadow naar under_review zodra de migratie draait).
- **Score-effect op handmatige moderatie** (nieuwe AFTER UPDATE-trigger
  `fn_entries_visibility_score_effect()` op `entries.visibility` — een
  UPDATE is per definitie een mens-beoordeling, de BEFORE INSERT-trigger
  raakt nooit een UPDATE): "✓ Goedkeuren" geeft nu **+5**, een nieuwe
  "🚫 Verbergen"-knop (CoordinatiePage.jsx, zet visibility op `shadow`)
  geeft **-30** — zwaarder dan de automatische -20/-15 (migratie 0005),
  omdat een mens het beoordeeld heeft. Beide eenmalig per overgang
  (OLD/NEW visibility moet verschillen), niet bij herhaalde acties.
- **Verbergen-knop is nieuw in de UI** — er bestond nog geen knop om een
  melding handmatig naar `shadow` te zetten (alleen Goedkeuren →
  `normal`); zonder die knop was de -30-straf onbereikbaar.
- **Kwartaalbonus (+5)** voor accounts >90 dagen oud zonder enige
  under_review/shadow-melding in die periode — losse SQL-functie
  `fn_trust_score_kwartaalbonus()`, geen realtime trigger (geen
  insert-moment om op te hangen). Moet zelf periodiek aangeroepen worden:
  via `pg_cron` (als die extensie aanstaat in het Supabase-project) of
  handmatig elk kwartaal in de SQL-editor — zie het commentaarblok in de
  migratie voor de exacte `cron.schedule(...)`-aanroep. Niet door een
  agent te plannen (operationele Supabase-dashboard-actie).

## Groepenfunctie — vervangt "Uitnodigen" (sinds 2026-06-23, migraties 0015/0016/0018 uitgevoerd)

Vervangt de hieronder beschreven "Buren uitnodigen"-flow volledig (die
bestaat niet meer — `DeeltokenGenerator.jsx`/`UitnodigenMenu.jsx`/
`lib/supabase/deeltokens.js` zijn verwijderd). Zie DECISIONS.md voor de
volledige afweging (naast i.p.v. in plaats van de buurt-deling, melder
kiest per groep, trust-score hergebruik).

- **Nieuwe BottomNav-tab "Groepen"** (`src/components/groepen/`) i.p.v.
  de header-knop — `GroepenPage.jsx` (openbare groepen browsen/groep
  starten/mijn groepen) en `GroepPage.jsx` (detailpagina: leden, rollen,
  uitnodigingen + QR, trust-score, meldingenlijst).
- **Database**: `groepen`/`groep_leden`/`groep_uitnodigingen`/
  `entries_groepen` + SECURITY DEFINER-functies + RLS
  (`supabase/migrations/0015_groepen.sql`, uitgevoerd). Migratie 0018
  herstelt een bug uit 0015 — de SELECT-policy op `groep_leden`
  verwees naar zichzelf ("infinite recursion detected in policy for
  relation groep_leden", trof ook Moderatie en de entries-cloud-sync) —
  fix via `fn_is_groepslid()` (SECURITY DEFINER), ook uitgevoerd.
  Migratie 0016 (`deel_meldingen`/`opt_in_groepen` + trigger) eveneens
  uitgevoerd, zie hieronder.
- **Backend**: `src/lib/groepen/` (`groepen.js`, `groepLeden.js`,
  `uitnodigingen.js`, `trustZichtbaarheid.js`, `rollen.js`).
- **Rollen per groep** (`groep_leden.rol`, vrije tekst zoals
  `user_roles.role`): `lid`/`beheerder`/`hoofdbeheerder`. Hoofdbeheerder
  is altijd de aanmaker; aantal beheerders is begrensd door
  `groepen.max_beheerders` (1-5, instelbaar door de hoofdbeheerder).
- **Trust-tier-gestuurde detailweergave binnen een groep**
  (`trustZichtbaarheid.js`) — hergebruikt de bandbreedtes uit migratie
  0014 (0-19/20-39 laag, 40-79 gemiddeld, 80-100 hoog) om te bepalen
  hoeveel van een gedeelde melding een KIJKER ziet (exacte locatie/
  metadata/melderinfo), gebaseerd op zijn eigen trust_score. Geconfigureerd
  via een array, niet hardcoded if/else, voor toekomstige extra niveaus.
- **Uitnodigingen** (`groep_uitnodigingen`): link + QR-code (nieuwe
  dependency `qrcode`), instelbaar aantal gebruikers (1-5) en verlooptijd
  (24/48/72u), met teller voor keer-geopend/keer-gebruikt. Geen browser-
  Notification (bewust, zie "Buurt-notificaties verwijderd" hieronder) —
  statistieken zijn alleen zichtbaar als de beheerder zelf de groepspagina
  opent.
- **"Recente meldingen" (Dashboard) is soberder**: toont nu alleen nog
  meldingstype, datum en algemene regio (gemeente/provincie) —
  gezondheidsklachten-badge, sync-status, windgegevens, mini-kaartje,
  omschrijving, melder-code en bestandsaantal zijn uit de compacte
  `MeldingCard.jsx`-variant verwijderd. De niet-compacte/Tijdlijn-variant
  is ongewijzigd.

## Privacybescherming melders: notificaties verwijderd + 30 min vertraging (sinds 2026-06-22)

- **Buurt-notificatiefunctie volledig verwijderd** (`useBuurtNotificaties.js`,
  `NotificatieBanner.jsx`/`.css`, `NotificatieInstellingen.jsx` — geen van
  alle bestaan nog). Geen browser-`Notification` of in-app banner meer bij
  een nieuwe gedeelde melding van een ander. Zie DECISIONS.md voor de
  reden (identiteitsbescherming melders tegen een mogelijk
  geïnfiltreerde teler in de buurt-groep).
- **Bereik-instelling (1/2,5/5 km) blijft bestaan**, los van de
  verwijderde notificaties — regelt hoe ver andermans gedeelde meldingen
  op Dashboard en Tijdlijn zichtbaar zijn. Verplaatst van de (verwijderde)
  `NotificatieInstellingen`-toggle naar een eigen "📍 Bereik
  buurtmeldingen"-select in het account-menu (`AccountMenu.jsx`), altijd
  zichtbaar i.p.v. alleen als notificaties aanstonden.
  `lib/notificaties/buurtMelding.js` heet nog steeds zo (niet hernoemd),
  exporteert nu `laadBereikMeter()`/`slaBereikMeterOp()` i.p.v. de oude
  notificatie-instellingen-paar.
- **Andermans gedeelde meldingen (`opt_in_buurt`) pas zichtbaar 30 minuten
  na het melden** — `magAndermansMeldingTonen()`
  (`lib/meldingen/buurtVertraging.js`), gebaseerd op `entries.created_at`
  (server-tijdstip, niet het vrij invoerbare `timestamp_local`). Geldt op
  Dashboard (`DashboardPage.jsx` → `meldingenInBereik`, dus ook de kaart en
  "Recente meldingen") én Tijdlijn (`TijdlijnPage.jsx` →
  "Gedeelde meldingen in jouw buurt"-filter). Eigen meldingen blijven voor
  de melder zelf altijd direct zichtbaar. Geldt **niet** voor het
  admin/coordinator-zicht (CoordinatiePage, buurtgebied-export,
  buurtrapport) — dat is al een vertrouwde rol, bewust ongewijzigd.
- `entries.js`'s `laadVanSupabase()`-mapping zet nu ook `created_at` door
  naar het lokale melding-object (stond er voorheen niet expliciet in,
  alleen indirect via `sync_at`) — nodig als betrouwbare bron voor de
  vertraging.

## "Recente meldingen" opmaak + mini-kaartje privacy (sinds 2026-06-22)

- **Mini-kaartje (`MeldingMiniKaart.jsx`) toont een effen gekleurde stip**
  i.p.v. een geroteerd type-emoji-icoon — bij 26px was de tegengedraaide
  emoji onduidelijk leesbaar; het type staat al in de badge erboven. Kleur
  komt uit `TYPE_KLEUR` in `MeldingCard.jsx` (dezelfde kleuren als de
  kaart-markers op Dashboard/Buurtgebied tekenen, los gehouden van die
  bestanden — geen gedeelde module, bewuste duplicatie zoals daar al
  bestond tussen `DashboardKaart.jsx`/`BuurtgebiedTekenaar.jsx`).
- **Mini-kaartje (exacte locatie-pin) alleen nog bij eigen meldingen** —
  voor andermans gedeelde melding (`opt_in_buurt`) is een exacte pin op
  een kaartje zelf een herleidbaarheidsrisico, hetzelfde dreigingsmodel als
  de 30-minuten-vertraging (zie hierboven): een teler zou een melder
  alsnog tot op de meter kunnen lokaliseren. De losse afstandTekst
  ("Melding X meter vanaf jouw positie") blijft wel zichtbaar bij
  andermans melding — dat is alleen een getal, geen kaart.
- **Compacte kaart ("Recente meldingen") toont relatieve tijd** ("12 min
  geleden" / "3 u geleden" / "2d geleden") i.p.v. de volledige datum/tijd,
  valt terug op de volledige datum na een week (`relatieveTijd()` in
  MeldingCard.jsx). Melding-ID, bestandsaantal en melder-code zijn uit de
  compacte rij gehaald (stonden te dicht op elkaar, lage waarde op dit
  niveau — wel nog in de detail-modal/niet-compacte Tijdlijn-kaart). Een
  gezondheidsklacht is verplaatst naar een eigen badge naast het type
  (rij 1) i.p.v. tussen de overige meta-iconen, als enige signaal dat in
  dit overzicht mag opvallen.

## Navigatie/thema-herontwerp (sinds 2026-06-23)

- **Navigatie-iconen vervangen door de `icon_`-varianten**
  (`src/assets/ui-icons/icon_dashboard.png` etc.) — de eerder toegevoegde
  niet-`icon_`-bestanden zijn verwijderd. De aangeleverde `icon_*.png`-
  bestanden waren **RGB zonder alphakanaal** (PNG color type 2, geen
  transparantie) — de bestaande currentColor-mask-techniek
  (`BottomNav.jsx`) toonde ze daardoor als effen blokken i.p.v. lijn-
  iconen. Gerepareerd door alpha af te leiden uit pixelhelderheid
  (zwarte achtergrond → transparant, lijn-art → ondoorzichtig) en de
  bestanden te herschrijven als RGBA — geen wijziging aan het lijn-
  artwork zelf. Zie NEXT_STEPS.md als dit ooit met nieuwe asset-bestanden
  opnieuw moet gebeuren.
- **Bottom-navigatie is nu `position: fixed` i.p.v. `sticky`**
  (`BottomNav.css`) — sticky's positie hing af van de hoogte van de
  omliggende pagina-inhoud (de bug: de nav verschoof mee). `BottomNav.jsx`
  meet zijn eigen hoogte (`ResizeObserver`, zelfde patroon als
  `AppHeader.jsx`/`--header-hoogte`) en schrijft die naar een nieuwe
  `--nav-hoogte`-variabele; een nieuwe `.app-inhoud`-wrapper in `App.jsx`
  (`index.css`) gebruikt die als bottom-padding zodat content niet meer
  achter de vaste nav verdwijnt.
- **`--accent` is globaal nylon-groen** (`#8bc34a`, was `#00d4aa` teal) —
  op expliciet verzoek geen apart token alleen voor navigatie, dus elke
  knop/badge/focus-outline/actieve-status verandert mee.
  Kaart-/grafiek-/driftzone-kleuren die dezelfde teal-tint **hardcoded in
  JS** gebruiken (niet via de CSS-variabele, bv. OpenLayers-stijlen,
  Chart.js) zijn **bewust niet meegenomen** — dat raakt kaart-/drift-
  renderlogica, buiten de scope van een CSS-thema-wijziging.
- **`--bg-primary` is nu exact gelijk aan `docs/index.html`** (`#0a0e17`,
  was `#010510`) — `AppHeader.css`/`VoortgangBalk.css`'s hardcoded
  headerkleur is meeveranderd zodat header en root-achtergrond
  consistent blijven.
- **Nieuwe `.card-accent`-utility** (`theme.css`, parity met
  `docs/index.html`) — accent-border + gloed-schaduw voor een
  uitgelichte/geselecteerde kaart. Bewust geen blanket hover-effect op
  `.card` zelf (te veel bestaande, niet-interactieve kaarten in de app).

## Bestaande modules

- **Dashboard** (`components/dashboard/`) — statistieken, kaart met
  meldingmarkers/clustering/driftzones/Natura2000/percelen/Heatmap,
  maandgrafiek, recente meldingen.
- **Melding** (`components/melding/`) — formulier voor nieuwe meldingen,
  met eigen locatiekaart (pin plaatsen, GPS, percelen altijd zichtbaar,
  windvector-animatie, meetlint).
- **Tijdlijn** (`components/meldingen/`) — lijst/cluster-weergave van
  eigen + gedeelde meldingen.
- **Export** (`components/export/`) — PDF-dossier, CSV, KNMI-instellingen,
  Prullenbak (admin-only herstel).
- **Instellingen** (`components/instellingen/`) — GPS-voorkeur, bereik,
  thuislocatie, privacy/onderzoek-opt-out, account.
- **Coördinatie** (`components/coordinatie/`) — admin/coordinator-panel:
  alle meldingen/profielen, moderatie (zichtbaarheid), trust-score,
  postcode-backfill, buurtrapport-generator, buurtgebied-tekenaar.
  **`role==='admin'` of `'coordinator'`** (App.jsx/BottomNav.jsx + RLS-
  migratie 0011 — **bijgewerkt 2026-06-21**, was eerst admin-only).
- **Auth/Onboarding** — login/signup, handleiding, privacyverklaring,
  algemene voorwaarden.
- **Groepen** (`components/groepen/`) — leden/rollen, uitnodigingen,
  openbare groepen, trust-tier-gestuurde meldingenlijst. Vervangt de
  vroegere "Uitnodigen"-header-knop, zie hierboven.

## Actieve functionaliteit (kaart-specifiek, vaak verward)

- Dashboard: luchtfoto-toggle, driftzone-toggle, Natura2000-toggle
  (+infopopup bij klik), percelen-toggle (+infopopup bij klik — **nieuw
  2026-06-21**), Heatmap-toggle (**alleen `admin`/`coordinator`**,
  **nieuw 2026-06-21**), maand/jaar/dag-filter, live GPS-pin. Toont een
  zichtbare melding ("X van Y getoond") als het 100-meldingen-plafond
  geraakt wordt i.p.v. stilzwijgend af te kappen (**nieuw 2026-06-21**).
- Melding: percelenlaag **altijd aan** (geen toggle, **bug gefixt
  2026-06-21** — de laag werd nooit zichtbaar gezet), windvector-animatie
  bij geplaatste pin, meetlint vanaf eigen GPS-positie.
- Coördinatie: **windroos per perceel** (**nieuw 2026-06-21**,
  `lib/meldingen/statistieken.js` → `windrichtingPerPerceel()`) — toont per
  perceel de dominante windrichting + percentage, vanaf 3 meldingen met
  winddata.

## Recent verwijderd

- **Neerslagradar / "Hotspots" was géén verwijdering, wel gating**: let
  op het onderscheid — Neerslagradar (Buienradar-gebaseerd: radarbeelden,
  neerslagverwachting, spuitvenster-indicatie) is op 2026-06-21 **volledig
  verwijderd** uit de Dashboard-kaart, inclusief de bestanden
  `lib/weather/radarLaag.js`, `weerbericht.js`, `spuitvenster.js`. De
  Heatmap ("Hotspots") bestaat nog steeds, maar is nu rol-gated i.p.v.
  voor iedereen zichtbaar.
- Zie DECISIONS.md voor de waarom; dit is bewust, niet per ongeluk
  weggevallen — niet teruglezen uit git-historie en automatisch
  terugzetten.

## Performance (sinds 2026-06-21)

- **Code-splitting**: `DashboardKaart.jsx`, `LocatieKaart.jsx`,
  `MeldingDetailModal.jsx` (incl. `DriftZoneKaart` erin) en
  `BuurtgebiedTekenaar.jsx` zijn `React.lazy()`-geladen, plus een dynamic
  import van `meldingKaartAfbeelding.js` binnen `lib/export/pdf.js`.
  Hoofdbundel: 1.377 MB → ~751 KB (gzip 414 KB → 228 KB). OpenLayers zit nu
  in losse, on-demand chunks (`lagen-*.js` ~318KB, `perceelLaag-*.js`
  ~136KB, `DashboardKaart-*.js` ~113KB, etc.) i.p.v. in de hoofdbundel.
  `MeldingenLijst.jsx` is dead code (nergens geïmporteerd) — niet
  meegenomen in de lazy-load-ronde, niet verwijderd (buiten scope).
- **Realtime-subscriptie weer ongefilterd** (`useSupabaseSync.js`): een
  poging om dit te filteren (user_id/opt_in_buurt) veroorzaakte bij de
  eerste echte login een oneindige reconnect-lus en bevroor de app —
  **teruggedraaid op 2026-06-21**, zie NEXT_STEPS.md.
- **Reconnect-sync**: `window.addEventListener('online', syncNu)`
  toegevoegd — de offline-queue wordt nu automatisch verwerkt zodra de
  verbinding teruggekomt, niet pas bij de volgende handmatige actie.
- **Gedeelde PDOK-WFS-client**: `lib/pdok/wfsClient.js` (bbox-opbouw +
  fetch/validatie) — `perceel.js`/`perceelLaag.js`/`natura2000.js`/
  `natura2000Laag.js` bouwen er nu op voort i.p.v. elk een eigen
  fetch-implementatie. Bewust geen OpenLayers-import in `wfsClient.js`
  zelf (zou de hoofdbundel weer vergroten via `perceel.js`/`natura2000.js`,
  die niet lazy-geladen zijn).

## Database-migraties

Alle migraties **0001 t/m 0013 en 0015 t/m 0018 zijn uitgevoerd**
(0015-0018 bevestigd via Supabase op 2026-06-23) — inclusief de 5km-
privacygrens (0009), de coordinator-RLS (0011), Groepen (0015/0016) en de
RLS-recursiefix op `groep_leden` (0018). **Migratie 0014 (trust-score
op-/afschaling) is nog niet uitgevoerd** — zie NEXT_STEPS.md. Nieuwe
migraties na 0018 toevoegen op nummer 0019.

## Dossier/bewijskracht (sinds 2026-06-21)

- **PDF-dossier toont nu de volledige EXIF/GPS-gestripte foto** i.p.v. de
  extra-gecomprimeerde thumbnail (`lib/export/pdf.js`) — de volledige
  versie stond al in IndexedDB (`idbSaveBijlage`), maar werd voorheen
  altijd overschaduwd door `f.thumbnail` in de prioriteitsvolgorde.
- **Per-foto SHA-256-hash van het ORIGINEEL nu zichtbaar in het dossier**
  (was al berekend en opgeslagen, stond nergens getoond) — met een
  toelichtende tekst dat de hash bovenaan de sectie de meldinggegevens
  (metadata) verifieert, niet de foto's. Geen nieuwe hash-berekening, geen
  wijziging aan SHA-256/RFC3161-logica zelf (freeze-zone gerespecteerd) —
  alleen bestaande waarden eerlijker tonen/labelen.

## Bekende beperkingen / inconsistenties

- **`coordinator`-rol dekt niet alles wat `admin` dekt** — bewust: geen
  toegang tot account-verwijdering (migratie 0008-policy) en geen
  Prullenbak-herstel (InstellingenPage/PrullenbakCard, blijft
  `isAdmin()`-only). Dit is per ontwerp, niet per ongeluk — zie
  DECISIONS.md voor de afgebakende scope.
- **Geen db-enum/CHECK-constraint op `user_roles.role`**: een typo in de
  database (bv. `'Admin'` met hoofdletter) faalt stil terug naar
  `'gebruiker'`-gedrag, zonder foutmelding.
- **`docs/` is geen documentatiemap**: het is de legacy single-file
  HTML-prototype (`docs/index.html`, 7500+ regels) waarnaar veel
  code-comments verwijzen ("Komt overeen met ... uit docs/index.html").
  Dit geheugensysteem staat ernaast in dezelfde map als losse
  `.md`-bestanden — verwar dit niet met "de documentatie van de oude app".

## Belangrijke bestanden en mappen

- `src/components/dashboard/DashboardKaart.jsx` — Dashboard-kaart, alle
  laag-toggles, popup-logica (Natura2000 + percelen).
- `src/components/melding/LocatieKaart.jsx` — Melding-pagina kaart.
- `src/lib/pdok/` — PDOK-integraties (percelen, Natura2000, postcode, BAG).
- `src/lib/weather/` — Open-Meteo (`openMeteo.js`), KNMI
  (`knmi.js`), Pasquill-klasse (`pasquill.js`). Geen Buienradar/radar meer.
- `src/lib/rollen.js` — enige plek waar rolcontroles (`isAdmin`,
  `isCoordinatorOfAdmin`) gedefinieerd staan — nieuwe rolcontroles hier
  toevoegen, niet inline in componenten.
- `src/lib/drift/` — driftberekening + driftzone-laag (windafhankelijk).
- `src/hooks/useAuth.js` — laadt `gebruikerRol` uit `user_roles.role`,
  default `'gebruiker'`.
- `supabase/migrations/` — chronologisch schema-log (handmatig uitvoeren,
  zie root-CLAUDE.md).
- `docs/index.html` — legacy prototype, referentie-implementatie voor
  "hoe deed de oude app dit" (zie comments in src/).
