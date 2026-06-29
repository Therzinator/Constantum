# Huidige staat — SpuitLogger

Momentopname. Dit bestand veroudert sneller dan DOMAIN_KNOWLEDGE.md/
DECISIONS.md — bij twijfel altijd verifiëren tegen de code (`git log`,
grep), niet blind vertrouwen op een oude snapshot.

Laatst bijgewerkt: 2026-06-29.

## Herontwerp Instellingen/Export/Groepen/Coördinatie (sinds 2026-06-24)

- **Nieuw gedeeld component `src/components/ui/Collapsible.jsx`** —
  herbruikbare inklapbare sectie (knop-header met icoon/titel/optioneel
  badge-aantal + chevron, `min-height: 48px`, children alleen gemount als
  open). Vervangt permanent-uitgeklapte kaartenstapels door progressive
  disclosure, conform mobile-UI-best-practices (tik-doelen ≥44px,
  kritieke content boven de vouw, secundaire content ingeklapt).
- **CoordinatiePage.jsx** ("Moderatie"-tab in BottomNav) — alle 8 secties
  zitten nu in een `Collapsible`. Alleen "Filter op provincie/gemeente" en
  "Onder review/shadow" staan standaard open (de eigenlijke
  moderatiewachtrij); de rest (opt-in-postcodes, trust-score-verdeling,
  perceel-analyse, windroos, melder-overzicht) is standaard dicht.
  Trust-score-verdeling/perceel-analyse/windroos tonen nu een CSS-only
  horizontale stat-balk i.p.v. platte tekstregels. Buurtgebied
  tekenen/Buurtrapport/KNMI-instellingen zitten samen onder één
  "Rapportages & tools"-Collapsible — BuurtgebiedTekenaar (OpenLayers,
  lazy) laadt daardoor pas bij het openen van die sectie, een gratis
  perf-bonus naast de UI-wijziging.
- **GroepenPage.jsx** — "Mijn groepen"-kaarten tonen leden/meldingen nu
  als stat-chips i.p.v. platte regels; "Openbare groepen browsen" zit in
  een Collapsible (standaard dicht, behalve open als de gebruiker nog 0
  eigen groepen heeft).
- **ExportPage.jsx** (ook gebruikt door InstellingenPage) — "Dossier
  Informatie" toont nu een 2-koloms stat-grid voor de 4 belangrijkste
  getallen i.p.v. 6 platte mono-regels.
- **InstellingenPage.jsx** — "Opslag opschonen"/"Gevaarzone"/"Juridisch"
  zitten nu in een Collapsible (standaard dicht); Account-betrouwbaarheid
  (TrustIndicator, met nieuwe CSS-gauge-balk bij de trust-score) en
  Gegevens & Privacy blijven altijd zichtbaar boven aan de pagina.
- **CSS utility-klassen project-breed opgelost (2026-06-29)**: de
  `p-1..p-4`/`px-3/4`/`py-1/2`/`mb-1..mb-3`/`mt-1..mt-3`/`gap-2`/`flex`
  classNames waren no-ops (geen Tailwind aanwezig). Nu als echte CSS-regels
  in `src/styles/theme.css` (globaal). `.btn-primary` en `.btn-outline`
  krijgen `min-height: 44px; min-width: 44px` (Apple HIG touch-target).

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
- **Testen**: ESLint, Playwright (`npm run test:e2e`), Vitest (`npm test`,
  60 unit-tests voor pure functies in `src/lib/meldingen/`), `npm run build`
  als rooktest. Vitest-config in `vitest.config.js`, alleen `src/**/*.test.js`.

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
  CoordinatiePage aangevuld worden, zie NEXT_STEPS.md. Gevuld via
  `zoekGemeenteProvinciePDOK()` (`lib/pdok/postcode.js`) bij het
  plaatsen van de meldingspin (`useNieuweMeldingForm.js`, fire-and-forget
  — geen blokkade voor de gebruiker; bij mislukken gaat gemeente=null de
  database in). **Fix 2026-06-29**: `type=adres` verwijderd uit de
  PDOK-Locatieserver-URL — dit veroorzaakte lege results bij agrarische
  percelen (geen adres in de buurt). Vervangen door
  `fl=gemeentenaam,provincienaam,woonplaatsnaam`, 5s
  `AbortController`-timeout en 1 automatische retry.
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

## Trust-score systeem — volledig operationeel (migraties 0022/0023/0024, 2026-06-29)

Migratie 0014 is nooit volledig uitgevoerd; migratie 0022 vervangt en
voltooit het geheel. Het systeem draait nu met 4 lagen actief.

### 4-tier zichtbaarheidslogica (`fn_entries_set_visibility`, BEFORE INSERT)
- **0-19 "Geschaduwd"**: altijd `shadow`
- **20-39 "Verhoogd toezicht"**: altijd `under_review`
- **40-79 "Standaard"**: `under_review` bij account <48u of <7 dagen +
  ≥5 meldingen/dag; anders `normal`
- **80-100 "Vertrouwd"**: altijd `normal`, geen account-leeftijdschecks

### Score-effect handmatige moderatie (`fn_entries_visibility_score_effect`, AFTER UPDATE)
- Coordinator zet melding naar `shadow` → **-30** (eenmalig per overgang)
- Coordinator keurt melding goed (`normal`) → **+5**

### Actie-gebaseerde bonussen (`fn_trust_score_actie_bonus`, migratie 0023)
Beloont kwaliteitsgedrag van gevestigde gebruikers. 5 guards:
1. Account ≥30 dagen oud
2. Minimaal 5 normale meldingen als schone basis
3. Deduplicatie (per entry of per user)
4. Dagelijkse cap +5 (alleen per-entry bonussen)
5. Perceel-spam: ≥5 meldingen op zelfde perceel in 24u → geen bonus

| Actie | Delta | Type |
|-------|-------|------|
| `melding_volledig` (perceelnummer + beschrijving) | +2 | per entry |
| `opt_in_buurt` | +3 | per entry |
| `drempel_5_meldingen` | +3 | eenmalig |
| `drempel_10_meldingen` | +5 | eenmalig |
| `drempel_25/50_meldingen` | +5 elk | eenmalig |
| `telefoon_geverifieerd` | +8 | eenmalig |

Bonus-log in `trust_score_events`-tabel (RLS: user leest eigen log).

### Kwartaalbonus (`fn_trust_score_kwartaalbonus`)
+5 voor accounts >90 dagen zonder recente incidenten. Gepland via
**pg_cron** (actief, job `trust_score_kwartaalbonus`, `0 3 1 */3 *`).

### Automatische misbruikdetectie (`fn_entries_misbruikdetectie`, AFTER INSERT)
- ≥11 meldingen op zelfde perceel in 24u → -20
- ≥2 identieke beschrijvingen → -15

### Legacy triggers verwijderd (migratie 0024)
`trg_nieuwe_melding_review` (overschreef 4-tier voor scores 20-39 en 80+)
en `trg_trust_score_check` (dubbele -40-straf op 11e GPS-melding) zijn
verwijderd. Alleen de 7 correcte triggers staan nog op `entries`.

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
  metadata/melderinfo/**foto's**), gebaseerd op zijn eigen trust_score.
  Geconfigureerd via een array, niet hardcoded if/else, voor toekomstige
  extra niveaus.
- **Melding-detailweergave binnen Groepen (sinds 2026-06-24)** — kaarten
  in `GroepMeldingenLijst.jsx` zijn nu klikbaar en openen
  `GroepMeldingDetailModal.jsx`, een lichtere variant van
  `MeldingDetailModal.jsx` (geen hash/RFC3161/device/weerdata — die horen
  bij het bewijsdossier, niet bij de sociale Groepen-functie). Toont
  dezelfde trust-tier-gate als de kaart (`toon`-object), nu ook voor
  foto's: alleen leden met "hoog" trust-tier zien foto's, opgehaald via de
  bestaande `laadBijlagenVanSupabase()` (`lib/supabase/bijlagen.js`,
  zelfde Storage-signed-URL-aanpak als de admin-buurtgebied-export).
  Afhankelijk van onbevestigde `attachments`/storage-RLS, zie
  NEXT_STEPS.md.
- **Uitnodigingen** (`groep_uitnodigingen`): link + QR-code (nieuwe
  dependency `qrcode`), instelbaar aantal gebruikers (1-5) en verlooptijd
  (24/48/72u), met teller voor keer-geopend/keer-gebruikt. Geen browser-
  Notification (bewust, zie "Buurt-notificaties verwijderd" hieronder) —
  statistieken zijn alleen zichtbaar als de beheerder zelf de groepspagina
  opent. **Sinds 2026-06-24**: ook delen via de systeem-deelsheet
  (`navigator.share()` — WhatsApp/Signal/e-mail/etc., met dezelfde
  kant-en-klare deeltekst als "Kopieer"; valt terug op kopiëren als
  `navigator.share` niet beschikbaar is, bv. desktop-Firefox), en een
  "Verwijderen"-knop voor ingetrokken/verlopen/volle uitnodigingen
  (`verwijderUitnodiging()`, **migratie 0020 nodig** — ontbrekende
  DELETE-policy, zelfde patroon als migratie 0019 voor feedback).
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
- **Realtime-subscriptie nu gefilterd met backoff** (`useSupabaseSync.js`,
  2026-06-29): twee aparte `postgres_changes`-channels met server-side
  filters (`user_id=eq.{uid}` voor eigen meldingen; `opt_in_buurt=eq.true`
  voor buurtmeldingen). Root-oorzaak van de eerdere reconnect-lus
  (2026-06-21) was instabiele `laadVanCloud`-dep in `startRealtime` —
  opgelost via `laadVanCloudRef` (ref die elke render bijgewerkt wordt,
  zodat `startRealtime` stabiel is op `[user]` en het useEffect niet meer
  per render trigt). Exponential backoff 2s → 4s → 8s, max 3 retries.
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

Alle migraties **0001 t/m 0026 zijn uitgevoerd** (0025:
spuitregister-brief, client-only placeholder; 0026: CHECK-constraint op
`user_roles.role` — beperkt tot `'gebruiker'`, `'admin'`, `'coordinator'`,
gesynchroniseerd met `src/lib/rollen.js`). Nieuwe migraties na 0026
toevoegen op nummer 0027.

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
- **Opgeslagen/geüploade foto's beperkt tot 3000px/85%-JPEG (sinds
  2026-06-24)**, was ongewijzigd 0,92-kwaliteit op volledige resolutie
  (`stripEXIFGPS()`, `lib/bewijsmateriaal/exif.js`) — verkleint typische
  telefoonfoto's (4000px+) met ~40-60%, relevant tegen de Supabase
  Storage-limiet. **Raakt de bewijswaarde niet**: de SHA-256-hash per foto
  wordt al vóór deze stap berekend op het onbewerkte bestand
  (`hashFile()` in `useNieuweMeldingForm.js`) en is dus, zoals al
  toegelicht in het dossier, een hash van het origineel — niet van de
  opgeslagen kopie. Geldt alleen voor foto's; video's lopen niet door
  `stripEXIFGPS()` en bleven onverkleind — zie hieronder.
- **Video-compressie vóór cloud-opslag (2026-06-29)**: `comprimeerVideo()`
  in `lib/bewijsmateriaal/exif.js` — hert-encodeert video's ≥5 MB via
  `MediaRecorder` (canvas captureStream 30fps + audio via
  `video.captureStream()`), max 1280×720, 1,5 Mbps. Hash berekend vóór
  compressie — bewijswaarde intact. Geeft origineel terug als MediaRecorder
  niet beschikbaar is, geen supported codec, of compressie geen winst
  oplevert. Aanroep in `useNieuweMeldingForm.js` na `hashFile()` met een
  ⏳-toast bij grote video's.

## Spuitregister opvraagbrief (2026-06-29)

- **Nieuwe feature op ExportPage** (`src/components/export/SpuitregisterBrief.jsx`,
  `src/lib/export/spuitregisterBrief.js`) — genereert een vooringevulde
  formele brief voor inzageverzoeken op grond van art. 67 VO 1107/2009,
  gebaseerd op uitspraken Rb. Noord-Nederland 12 januari 2026 (zaaknummers
  LEE 23/5100 en LEE 23/1511, ECLI:NL:RBNNE:2026:130 en
  ECLI:NL:RBNNE:2026:129). Selecteer een melding met perceelnummer als
  basis; vul naam en adres in; preview in readonly-textarea; download als
  HTML-blob die in de browser als PDF afgedrukt kan worden.
- **RFC 3161 null-safe**: meldingen zonder tijdstempel (offline aangemaakt,
  of vóór RFC 3161-implementatie) genereren een geldige brief met een
  waarschuwingsblok in de UI en de opgeslagen datum in de voetnoot i.p.v.
  een tijdstempel.
- **Hoger beroep voetnoot**: het ministerie van LVVN heeft hoger beroep
  ingesteld bij de Raad van State; de brief vermeldt dit expliciet
  (schorsende werking, aanhouding van verzoeken, metenweten.nl).
- **Geen DB-wijzigingen** — volledig client-side; migratie 0025 is een
  no-op placeholder.

## Bekende beperkingen / inconsistenties

- **`coordinator`-rol dekt niet alles wat `admin` dekt** — bewust: geen
  toegang tot account-verwijdering (migratie 0008-policy) en geen
  Prullenbak-herstel (InstellingenPage/PrullenbakCard, blijft
  `isAdmin()`-only). Dit is per ontwerp, niet per ongeluk — zie
  DECISIONS.md voor de afgebakende scope.
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
