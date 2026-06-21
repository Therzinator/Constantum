# Huidige staat — SpuitLogger

Momentopname. Dit bestand veroudert sneller dan DOMAIN_KNOWLEDGE.md/
DECISIONS.md — bij twijfel altijd verifiëren tegen de code (`git log`,
grep), niet blind vertrouwen op een oude snapshot.

Laatst bijgewerkt: 2026-06-21.

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
- **Realtime-subscriptie gefilterd**: `useSupabaseSync.js` had één
  ongefilterde listener op de volledige `entries`-tabel; nu twee gefilterde
  listeners (`user_id=eq.<eigen-id>` voor reload-triggers,
  `opt_in_buurt=eq.true`+`INSERT` voor buurt-notificaties van anderen).
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

Alle migraties **0001 t/m 0011 zijn uitgevoerd** (bevestigd door de
gebruiker op 2026-06-21, geen foutmeldingen) — inclusief de 5km-
privacygrens (0009) en de coordinator-RLS (0011). Nieuwe migraties na
0011 toevoegen op nummer 0012.

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
