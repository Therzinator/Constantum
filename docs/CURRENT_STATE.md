# Huidige staat — Constatum (voorheen SpuitLogger)

Momentopname. Dit bestand veroudert sneller dan DOMAIN_KNOWLEDGE.md/
DECISIONS.md — bij twijfel altijd verifiëren tegen de code (`git log`,
grep), niet blind vertrouwen op een oude snapshot.

Laatst bijgewerkt: 2026-07-01 (post-COVID kwetsbare groep, auto-cleanup uitnodigingen, logout→loginscherm, PWA install-banner, contactadressen AV/Privacy, app-iconen vernieuwd, typografie-audit + font-size-tokensysteem, GitHub-repo hernoemd naar Constatum, crash-bij-uitloggen gefixt + ErrorBoundary, Dashboard-groepsfilter, Groepen Recent/Tijdlijn, app-iconen opnieuw uit icon_background.png, achteraf melding delen met groep, AV v2.0 + neutrale terminologie in Handleiding, opruiming + BottomNav-smalscherm-fix).

## Opruiming en BottomNav-smalscherm-fix (2026-07-01)

- **Vier ongebruikte icon-/logo-bestanden verwijderd**: `public/icons/icon_small.png`,
  `public/icons/header-logo.png`, `public/favicon.svg`, `public/icons.svg` —
  geverifieerd dat geen enkele nog gerefereerd werd (alleen een historische
  kleur-herkomst-comment in `theme.css` noemde `header-logo.png`, geen
  functionele referentie).
- **BottomNav-labels bij 320px + 6 tabs (coordinator/admin-rol met
  "Moderatie" erbij) knipten net af** (`scrollWidth > clientWidth`,
  geverifieerd met Playwright op 320/360/375/390/414px). Opgelost door bij
  de `max-width: 420px`-media-query de letter-spacing te verkrappen
  (-0.03em → -0.05em) en de horizontale padding naar 0 te zetten — geen
  labels ingekort, geen font-size verkleind (blijft op het
  `--font-size-xs`-token, zie typografie-audit).

## Algemene Voorwaarden v2.0 + neutrale terminologie in Handleiding (2026-07-01)

- **`AlgemeneVoorwaardenModal.jsx` bijgewerkt naar v2.0** (aangeleverd
  door de gebruiker als `docs/Constatum-AlgemeneVoorwaarden-v2.0.docx`,
  geëxtraheerd via de docx-XML — geen conversietool nodig). Inhoudelijke
  kern van v2.0: de gedefinieerde termen zijn generieker/neutraler
  gemaakt — **Melding → Waarneming**, **Dossier → Logboek**,
  **Buurtdossier → Gebiedsdossier**, **Teler → Betrokkene** (natuurlijk
  persoon óf rechtspersoon, niet meer specifiek "de agrarische
  ondernemer"). Overal waar de v1.1-tekst impliciet alleen over
  bestrijdingsmiddelen/spuitactiviteit sprak, spreekt v2.0 neutraal over
  "omgevingswaarnemingen"/"activiteiten en situaties in de
  buitenomgeving". Artikel 3 (verboden gebruik) spreekt nu over
  "personen of organisaties" i.p.v. specifiek "individuele telers".
- **`HandleidingModal.jsx` volgt dezelfde neutrale terminologie**, op
  expliciet verzoek van de gebruiker, MET het bewuste risico dat dit
  (voorlopig) niet aansluit bij de rest van de app-UI: Tijdlijn,
  Dashboard, Export, Groepen-pagina's, `MeldingForm.jsx` (het
  teler-/bedrijfsnaam-veld) en de database-kolommen gebruiken nog steeds
  "melding"/"dossier"/"buurtdossier"/"teler" — dat is bewust NIET
  meegenomen in deze wijziging (zie DECISIONS.md). Letterlijke
  UI-strings die niet zijn hernoemd (bv. de `Melder#XXXXXX`-code) zijn
  in de handleidingtekst ongewijzigd gelaten, om niet iets te beschrijven
  dat niet overeenkomt met wat er daadwerkelijk op het scherm staat.

## App-iconen opnieuw gegenereerd uit icon_background.png (2026-07-01)

- **Oorzaak "dikke witte rand" op het mobiele app-icoon gevonden**: de
  vorige bron `icon_large.png` is NIET volledig ondoorzichtig
  (`sharp(...).stats().isOpaque === false`) — de transparante marge rond
  het logo werd door iOS bij "Zet op beginscherm" als wit ingevuld. De
  nieuwe, door de gebruiker aangeleverde `src/assets/app-icon/
  icon_background.png` is wél volledig ondoorzichtig en veel strakker
  gecomponeerd (cirkel vult vrijwel het hele canvas).
- Alle PWA/Android/Apple-iconen (`public/icons/icon-*.png`,
  `apple-touch-icon.png`, maskable-varianten) opnieuw gegenereerd vanuit
  dit bestand, met `trim()` (zachte gloed-marge wegsnijden) + `fit:
  'cover'` (i.p.v. eerder `'contain'`) zodat het logo écht randvullend
  is, en `flatten()` tegen `--bg-primary` om restanttransparantie
  definitief uit te sluiten. Browser-favicon (16/32px) bewust
  ongewijzigd, zoals eerder besloten (zie DECISIONS.md).
- **Open Graph-deelicoon** (zichtbaar bij het delen van de link in
  WhatsApp/Telegram/Discord/Slack/iMessage e.d.) is hetzelfde bestand
  (`/icons/icon-512.png`, `index.html`'s `og:image`) — automatisch
  meegenomen door bovenstaande regeneratie. `index.html` kreeg ook
  `og:title`/`og:description`/`og:type` + `twitter:*`-varianten, die
  ontbraken — zonder `og:title` renderen sommige chat-apps helemaal geen
  preview-kaart.

## Achteraf melding delen met groep vanuit persoonlijke Tijdlijn (2026-07-01)

- **Nieuwe kaart "📤 Delen met groep"** in `MeldingDetailModal.jsx`
  (nieuw component `src/components/melding/DeelMetGroepenKaart.jsx`) —
  toont per groep waar "Deel mijn meldingen met deze groep"
  (`groep_leden.deel_meldingen`) aanstaat een aan/uit-checkbox, los van
  de bestaande checkbox bij het melden zelf die alleen op dát moment
  gold (migratie 0016). Alleen zichtbaar voor eigen, al gesynchroniseerde
  meldingen (niet voor andermans buurt-gedeelde melding die toevallig in
  dezelfde modal geopend wordt).
- **Geen nieuwe migratie nodig** — de RLS-insert-policy
  `entries_groepen_insert_eigen_melding_lid` (migratie 0015: eigen
  melding + lid van de groep) bestond al, maar werd nooit vanuit de UI
  gebruikt sinds de automatische deel-bij-melden-koppeling (migratie
  0016) de eerdere handmatige aanpak verving.
- Nieuwe functies `deelMeldingMetGroep()`/`haalGedeeldeGroepenVoorMelding()`
  in `lib/groepen/groepen.js`; `verwijderMeldingUitGroep()` (bestond al)
  hergebruikt voor het weer intrekken.

## Crash bij uitloggen + ErrorBoundary (2026-07-01)

- **Zwart scherm bij uitloggen in productie**: een `TypeError` (minified,
  "t is null") tijdens het uitloggen liet de hele React-boom verdwijnen —
  er was nergens in de app een Error Boundary, dus één onverwachte
  null-referentie ergens in de paginaboom nam ook `AuthOverlay.jsx` mee
  (los sibling-element, geen kind van de crashende boom). De exacte regel
  kon niet met zekerheid herleid worden uit de geminificeerde stacktrace.
- **`src/components/ui/ErrorBoundary.jsx`** (nieuw): vangt render-fouten
  in `<main>` op (App.jsx, `key={pagina}` zodat de fout-status niet
  blijft plakken na navigatie), toont een nette fallback, en stuurt
  automatisch terug naar Dashboard + het inlogscherm
  (`auth.setAuthOverlayVisible(true)`).
- **`vite.config.js`**: `build.sourcemap: true` — een volgende
  productiefout toont voortaan echte bestandsnamen/regelnummers.
- **App.jsx**: uitloggen gaat nu via een expliciete `handleUitloggen()`
  die na `auth.logout()` ook `pagina`/`actieveGroepId` terugzet naar
  Dashboard — bewust GEEN generiek `useEffect` op `!auth.user` (eerste
  versie deed dat wél en blokkeerde daarmee per ongeluk de Groepen-tab
  voor anonieme, nooit-ingelogde gebruikers; meteen weer gecorrigeerd).
- Twee ongeguarde `user.id`-aanroepen in `KwetsbareGroepen.jsx` (buiten
  het render-pad, in click-handlers) alsnog met een `if (!user) return;`
  afgeschermd.

## Header groter, kopij, kaart-popup-sluitknop (2026-07-01)

- Header-logo + "Constatum"/subtitel +25% opgeschaald (`AppHeader.css`).
- BottomNav Dashboard/Export-iconen +15% (`bottom-nav-icoon-dashboard`/
  `-export`) — die twee bronbestanden hebben zelf meer lege ruimte rond
  het lijnwerk dan de andere iconen, ogen daardoor kleiner bij gelijke
  boxgrootte.
- "Geografische Waarnemingen(Logboek)" overal vervangen door "Geografisch
  Logboek" (koppen header/inlogscherm, PWA-manifest, meta-description).
- Dashboard/Percelen/Natura2000-kaartpopups hebben nu een ×-sluitknop
  rechtsboven (`DashboardKaart.jsx`, gedelegeerde click-listener op het
  overlay-element).
- Instellingen-menu (account-dropdown in de header): "Handleiding" en
  "Feedback & vragen" verplaatst hierheen vanaf de Instellingen-pagina;
  nieuwe optie "Terug naar inlogscherm" (zichtbaar wanneer niet
  ingelogd). Nieuwe gebruikers moeten nu een checkbox aanvinken ("Ik ga
  akkoord met de Algemene Voorwaarden en heb de Privacyverklaring
  gelezen") vóór Registreren/Overslaan — Inloggen (bestaande gebruikers)
  blijft ongated.

## Dashboard-groepsfilter + Groepen Recent/Tijdlijn-clustering (2026-07-01)

- **Dashboard**: nieuw dropdown-filter "Filter op groep" (alleen zichtbaar
  als je lid bent van minstens één groep, via `haalMijnGroepen()`). Bij
  een gekozen groep vervangt een groepsmeldingen-weergave (stats + de
  hergebruikte `GroepMeldingenLijst`) de normale eigen+buurt-kaart/lijst
  — groepsmeldingen van ANDERE leden staan nooit in de lokale
  meldingen-store (alleen eigen + opt-in-buurt worden gesynct), dus dit
  is een aparte fetch, geen filter op de bestaande `meldingen`-array.
  Bewust GEEN hergebruik van `DashboardKaart`/`MeldingDetailModal` voor
  groepsdata — die tonen/vereisen SHA-256/RFC3161/device-detail dat
  `GroepMeldingDetailModal.jsx` juist bewust weglaat voor lage-trust
  kijkers; zie de eigen, lichtere kaart-/modal-component hieronder.
- **`GroepMeldingenLijst.jsx`** herschreven: toont nu "Recente
  meldingen" (laatste 5) én een "Tijdlijn" (alle meldingen, gegroepeerd
  tot gebeurtenissen via `clusterMeldingen()` — zelfde 8u/perceel-logica
  als de persoonlijke Tijdlijn), met een tab-toggle zoals Dashboard vs.
  TijdlijnPage voor persoonlijke meldingen.
- **Nieuwe componenten** `GroepMeldingKaart.jsx` (geëxtraheerd uit de
  oude `GroepMeldingenLijst.jsx`) en `GroepClusterKaart.jsx` (groeps-
  variant van `ClusterCard.jsx`) — beide reddigeren consequent via
  `toon` (trustZichtbaarheid.js) vóórdat clustering/rendering gebeurt,
  zodat een lage-trust-kijker nooit exacte locatie/omschrijving/
  melderinfo binnenkrijgt, ook niet indirect via de perceel-/GPS-
  gebaseerde clustering-groepering (die velden staan dan op `null`).
  `haalMeldingenVoorGroep()` haalt nu ook `perceelnummer` op (nodig voor
  clustering, ontbrak eerder).

## Typografie-audit en font-size-tokensysteem (2026-07-01)

Naar aanleiding van `src/audit/typografie-audit-2026-07-01.md` (mobiele
leesbaarheid buiten, WCAG 2.1 AA/Apple HIG/Material 3/NNG als referentie).
Alleen presentatielaag (CSS/inline-`style`) — geen SHA-256/RFC3161-logica,
PDOK/BAG-koppelingen of Supabase-schema aangeraakt.

- **Nieuw font-size-tokensysteem** in `src/styles/theme.css` (`:root`):
  `--font-size-xs` (12px) t/m `--font-size-2xl` (32px). Bijna alle
  hardcoded `font-size`-waarden onder 14px in `src/**/*.css` en inline
  `fontSize` in `src/**/*.jsx` zijn vervangen door deze tokens — geleide
  vuistregel: mono-metadata (hashes, timestamps, melder-codes,
  coördinaten) → `--font-size-xs`, tekst die de gebruiker actief moet
  lezen (formulierlabels, foutmeldingen, beschrijvingen, juridische
  tekst) → minimaal `--font-size-sm` (14px). Decoratieve icoon-chevrons
  en het versie-/copyright-voetnootje in `JuridischModal.css` zijn
  bewust ongemoeid gelaten.
- **`.section-label`** (theme.css) — het daadwerkelijke formulierlabel in
  `MeldingForm.jsx` (Locatie, Omschrijving, Geurintensiteit, etc.) en
  hergebruikt als sectiekopje elders — ging van 10.4px naar 14px.
  `.collapsible-header` (Collapsible.css, gebruikt door alle
  Collapsible-secties in Coördinatie/Groepen/Instellingen) kreeg
  dezelfde fix; dit was in de audit zelf nog gemist.
- **`--text-muted`-contrastfix**: was `#4a5d78` (2,9:1 tegen
  `--bg-primary`, faalde zelfs de WCAG-eis voor grote tekst), is nu
  `#77839c` (~5,1:1 tegen `--bg-primary`, ~4,6:1 tegen `--bg-card`). Eén
  tokenwijziging, werkt door op alle ~30+ plekken die de variabele
  gebruiken (melder-codes, timestamps, GPS-coördinaten, etc.).
- **Trust-tier-badge-contrastfix** (`CoordinatiePage.jsx`,
  `GroepPage.jsx`): witte badge-tekst op de vier tier-kleuren
  (`trustScore.js`, ongewijzigd) haalde 1,9–3,8:1 contrast. Tekstkleur
  vervangen door donker (`#0a0e17`) i.p.v. wit → 5–10:1 op alle vier
  tiers, plus font-size van 8,8–9,6px naar `--font-size-xs` (12px).
- **BottomNav-tab-labels**: van 12,2px (9,8px op schermen < 420px) naar
  `--font-size-xs` (12px) op beide breakpoints, plus `font-weight: 700`
  (op expliciet verzoek van de gebruiker, los van het auditrapport) voor
  betere leesbaarheid. Let op: het formaat was eerder bewust verkleind om
  labeloverlap te voorkomen (zie comment in `BottomNav.css`) — visueel
  controleren op zeer smalle schermen of labels nog passen; zo niet,
  labels inkorten, niet verder verkleinen.
- **Restant-fix na de audit**: 5 losse decoratieve icoon-chevrons/emoji
  (`.cd-chevron`, `.mf-standaardzin-chip-emoji`, `.mf-photo-remove`,
  `.mf-teler-chevron`, `.collapsible-chevron`) die de eerste implementatie-
  ronde miste, zijn alsnog naar de tokens omgezet.
- **Prioriteit 3 uit het auditrapport — afgehandeld**: de
  `--text-muted`-doorlichting is voltooid (zie vorige bullet). De
  hardcoded `#00d4aa`/oude-teal → `var(--accent)`-consolidatie is
  **bewust niet doorgevoerd** — bij navraag bleek dit 7 bestanden te
  raken (kaart-markers, drift-/windvisualisatie, maandgrafiek), dus
  render-logica i.p.v. alleen UI-tekst, en `docs/CURRENT_STATE.md`
  documenteerde al twee eerdere keren de bewuste keuze om die kleuren
  los te houden van het CSS-thema. De gebruiker heeft expliciet gekozen
  dit zo te laten — zie ook DECISIONS.md.

## Nieuwe features (2026-07-01)

### App-iconen vervangen door Constatum-branding (`public/icons/`, `vite.config.js`, `index.html`)
- Volledige icon-set (favicon 16/32px, Apple touch-icons 152/167/180px, Android
  72-512px + maskable-varianten 192/512px) opnieuw gegenereerd vanuit
  `src/assets/app-icon/icon_large.png` (nieuwe dependency `sharp`,
  `devDependencies`, alleen build-time gebruikt) — dit bronbestand was al de
  header-/inlog-logo (`AppHeader.jsx`/`AuthOverlay.jsx`, sinds de rebranding
  van 2026-06-30) maar de PWA-icon-set zelf (`public/icons/*`,
  `vite.config.js`'s `VitePWA`-manifest, `index.html`-favicons) was nog nooit
  bijgewerkt en verwees naar oudere SpuitLogger-assets.
- **`background_color`/`theme_color`** in het PWA-manifest en
  `index.html`'s `<meta name="theme-color">` gecorrigeerd van het
  verouderde `#010510` naar `#0a0e17` — gelijk aan `--bg-primary`
  (`theme.css`), dat al sinds 2026-06-23 dit exacte donkerblauw gebruikt;
  de manifest-kleur was toen niet meegenomen.
- **Browser-favicon (16/32px) bewust NIET vervangen**: een eerste versie
  genereerde ook de favicon automatisch uit `icon_large.png`
  (contain-fit + achtergrondkleur), maar dat gaf een andere crop dan het
  bestaande, met de hand gemaakte kleine icoon (`public/icons/icon_16px.png`/
  `icon_32px.png`, oorspronkelijk uit `src/assets/app-icon/`) en was
  minder leesbaar op klein formaat. Op verzoek van de gebruiker
  teruggedraaid: `index.html` verwijst weer naar die twee originele
  bestanden. Alle overige, wél vervangen iconen (Apple touch-icons,
  Android/PWA-formaten 48-512px, maskable-varianten) zijn ongewijzigd
  gebleven.
- **Nu écht ongebruikte bestanden** (bewust niet verwijderd, ter
  beoordeling): `public/icons/icon_small.png`, `header-logo.png`,
  `public/favicon.svg`, `public/icons.svg`.

### Kopij en repository
- Tekst "Geografische Waarnemingen" → "**Geografische Waarnemingen
  Logboek**" op de drie plekken waar die voorkwam: `AppHeader.jsx`
  (zichtbare subtitel onder het logo), `vite.config.js`
  (PWA-manifest-description) en `index.html` (meta-description).
- **GitHub-repository hernoemd** van `Therzinator/SpuitLogger` naar
  `Therzinator/Constatum` (buiten deze sessie om gedaan, ontdekt bij het
  pushen — GitHub redirect't automatisch). De lokale `origin`-remote-URL
  is bijgewerkt naar `https://github.com/Therzinator/Constatum.git`.

## Overige features (2026-07-01)

### Post-COVID / Long COVID toegevoegd aan kwetsbare groepen (`KwetsbareGroepen.jsx`)
- `{ id: 'post_covid', label: 'Post-COVID / Long COVID' }` toegevoegd aan de
  `SUBSTANTIEEL`-array — naast de 5 bestaande categorieën (diabetes, nierfalen,
  immunosuppressie, neurologisch, MCS). Geen DB-schema-aanpassing nodig:
  `user_profiles.kwetsbare_groepen` is JSONB (vrije array van string-IDs).

### Auto-cleanup verlopen uitnodigingslinks (`lib/groepen/uitnodigingen.js` + migratie 0035)
- **Client-side** (in `haalGroepUitnodigingen()`): na het ophalen worden
  ingetrokken of langer dan 24u verlopen uitnodigingen asynchroon verwijderd
  via `sb.from('groep_uitnodigingen').delete().in('id', [...])` (best-effort,
  niet-geblokkeerd). De returnwaarde bevat alleen nog actieve links.
- **Server-side** (migratie 0035): pg_cron-job `cleanup_verlopen_uitnodigingen`
  draait dagelijks om 04:00 UTC — verwijdert `ingetrokken=true` en
  `verloopt_op < NOW() - INTERVAL '24 hours'`. **Nog uit te voeren in Supabase.**

### Logout → terugkeer naar inlogscherm (`hooks/useAuth.js`)
- `logout()` roept nu ook `setAuthOverlayVisible(true)` aan — de `AuthOverlay`
  werd eerder niet opnieuw zichtbaar na uitloggen. Geen andere wijzigingen nodig:
  `AuthOverlay` is altijd gemount in `App.jsx` en reageerde al op de visibility-flag.

### PWA install-banner (`components/pwa/InstallBanner.jsx`)
- Nieuwe component die detecteert of de app als browser (niet standalone) wordt
  gebruikt. Toont een afwijsbare banner ("📲 Installeer Constatum als app…").
- Op Android/Chrome/desktop: `beforeinstallprompt` wordt gecaptured →
  "Installeren"-knop roept `event.prompt()` aan.
- Op iOS/Firefox (geen `beforeinstallprompt`): banner toont na 2s zonder
  installatieknop (informatieve mededeling).
- Afwijzing opgeslagen in `localStorage['constatum_pwa_banner_dismissed']`.
- Geïntegreerd in `App.jsx` direct onder `<UpdateBanner />`.

### Geo-verificatie EXIF (onderzoeksresultaat — geen implementatie)
De infrastructuur voor geo-verificatie van foto/video-bewijs is **al volledig
aanwezig**:
- `extractEXIF()` (`lib/bewijsmateriaal/exif.js:55-200`) leest al `gps_lat`,
  `gps_lng` én `datetime_original` (lokale tijd `"YYYY-MM-DDTHH:MM:SS"`).
- De aanroepvolgorde in `useNieuweMeldingForm.js` is correct:
  `hashFile()` → `extractEXIF()` → `stripEXIFGPS()` — GPS al geëxtraheerd
  vóór het strippen, hash al berekend op het origineel.
- EXIF-data zit al in `melding.bestanden[n].exif` (regel ~274 en ~366).
- **Wat nog ontbreekt**: vergelijkingsfunctie `verifieerEXIFLocatie()` in
  `exif.js` (haversine-afstand GPS-punt vs. `melding.gps` ≤~500m + tijdsverschil
  `datetime_original` vs. `melding.timestamp_local` ≤15-30 min) en opslaan als
  `bestand.exif_verificatie` + trust-score-bonus. Geen externe library nodig.
- iOS-kanttekening: iOS verwijdert EXIF vóór overdracht via systeem-share;
  geo-verificatie werkt dan niet (geen GPS in de EXIF). Verificatie is optioneel
  en weegt als bonus mee in de trust-score, niet als vereiste.

### Contactadressen Algemene Voorwaarden en Privacyverklaring bijgewerkt
- **AlgemeneVoorwaardenModal.jsx** v1.0 → **v1.1** (01-07-2026): artikel 12
  contactadres `Constatum@protonmail.com` → `info@constatum.nl`.
- **PrivacyVerklaringModal.jsx** v1.1 → **v1.2** (01-07-2026): alle drie
  vermeldingen vervangen door `privacy@constatum.nl` (sectie 1 "Wie zijn wij?",
  artikel 7 inleiding rechten, artikel 7.5 recht van bezwaar).

### Visibility oude meldingen (onderzoeksresultaat — geen actie nodig)
Meldingen van vóór de introductie van `opt_in_buurt` zijn **niet zichtbaar voor
anderen**. De query in `entries.js:164` filtert `.or('user_id.eq.X,opt_in_buurt.eq.true')`;
PostgreSQL matcht `eq.true` niet op `null` of `false`. Historische meldingen
hebben `opt_in_buurt = null` (nooit gesync) of `false` (fallback via
`|| false` in `sbSyncMelding`) — beide buiten het filter. RLS op DB-niveau
(migratie 0001) vormt de eigenlijke afdwinging.

## Accessibility-fixes, RFC 3161 sync-fix, UX (2026-06-30)

- **RFC 3161 sync-fix** (`src/lib/supabase/entries.js`): `laadVanSupabase()`
  mat `entry.rfc3161` niet terug naar het lokale melding-object — het veld
  werd alleen bewaard via de `...(bestaand || {})` spread (werkt alleen op
  hetzelfde apparaat). Nu expliciet gemapt als
  `entry.rfc3161 || bestaand?.rfc3161 || null`, zodat meldingen ook op een
  tweede apparaat of na localStorage-reset de TSA-tijdstempel tonen.
- **Account-menu: Supabase user-ID vervangen door Melder#-code**
  (`AccountMenu.jsx`): de UUID (`user.id`) is vervangen door
  `melderCode(user.email)` — toont de anonieme `Melder#XXXXXX`-code.
  Klikken kopieert de code. De `aria-haspopup` is gelijktijdig gecorrigeerd
  naar `"menu"` en menu-items kregen `role="menuitem"`.
- **19 accessibility-fixes** in 11 bestanden (commit `bc33074`):
  - Klikbare `<div>`s → `<button>` in `MeldingCard`, `MeldingDetailModal`,
    `MeldingForm` (foto-grid, suggesties).
  - `role="dialog" aria-modal="true"` op `MeldingDetailModal`,
    `DriftZoneModal`, `Lightbox`.
  - Focus-trap + auto-focus op sluitknop in `MeldingDetailModal`, `Lightbox`.
  - `aria-expanded` + `aria-haspopup="listbox"` op `CheckboxDropdown`.
  - `role="alert"` op foutmeldingen in `MeldingForm` en `AuthOverlay`.
  - `aria-current="page"` op actieve tab in `BottomNav`.
  - `:focus-visible`-outlines voor knoppen/inputs in `theme.css`.
  - `outline: none` → `outline: 2px solid transparent` (High Contrast Mode).
  - `.sync-badge`/`.photo-hash-badge` vergroot naar minimaal `0.65rem`.
  - Beschrijvende `alt`-tekst op foto's in `MeldingDetailModal`.
  - Fix 8 (overlay `aria-hidden`) bewust overgeslagen — `aria-modal="true"`
    op de inner div is de correcte aanpak.

## Rebranding SpuitLogger → Constatum (2026-06-30, commit 1c573c8)

- **22 bestanden hernoemd/bijgewerkt** — UI-tekst, modals, handleiding,
  privacyverklaring, algemene voorwaarden, PDF/export-headers
  ("Constatum — Juridisch Dossier"), PWA manifest (vite.config.js),
  `<title>`, package.json (`"name": "constatum"`), CLAUDE.md.
- **docs/index.html (legacy app)** bijgewerkt, versie 8.43 → 8.44.
- **Bewust ongewijzigd**: localStorage keys (`spuitlogger_*`, `spuitlog_*`
  prefix behouden — bestaande gebruikersdata intact), domeintermen
  (`spuitdatum`, `spuitactiviteit` etc.), database kolom-/tabelnamen.
- **Handmatige acties nog te doen**: DNS constatum.nl, Vercel
  domeinkoppeling, GitHub repo hernoemen, drie .docx juridische
  documenten herschrijven, e-mailadres Constatum@protonmail.com aanmaken.

## Kwetsbare groepen profielinstelling (2026-06-30, migratie 0034)

- **Juridische onderbouwing**: gerechtshof Den Bosch (Sevenum-zaak 2024,
  hoger beroep) woog expliciet aanwezigheid en afstand van kwetsbare
  bewoners (kinderen) mee in een spuitverbod.
- **AVG art. 9** — bijzondere categorie persoonsgegevens. Progressive
  disclosure-flow: uitleg eerst, uitdrukkelijke aparte toestemmings-
  checkbox, daarna 10 categorieën in twee bewijssterkte-groepen
  ("Sterk wetenschappelijk bewijs" / "Substantieel bewijs").
- **Eenmalig profiel** in Instellingen → Gegevens & Privacy (Collapsible
  "🛡️ Kwetsbare personen in huishouden", standaard dicht).
- **Automatische koppeling**: elke nieuwe melding krijgt
  `entries.kwetsbare_groep_aanwezig = true` als instelling actief is —
  de specifieke categorieën blijven in `user_profiles.kwetsbare_groepen`
  (JSONB), worden nooit naar entries gekopieerd.
- **SHA-256 integriteit**: `kwetsbare_groep_aanwezig` staat vóór de
  hash-berekening in `useNieuweMeldingForm.js` (regel 355 vs. 377) —
  zit volledig in de hash-input. ✓
- **PDF**: geel waarschuwingsblok bij `kwetsbare_groep_aanwezig=true`.
- **Privacyverklaring**: sectie 2.5 toegevoegd (versie 1.1).
- **Admin-afscherming**: `haalAlleProfielenAdmin()` selecteert de
  kwetsbare-groepen-kolommen expliciet NIET.
- **Migratie 0034** staat klaar — nog uit te voeren in Supabase.

## Groep trust-score ontkoppeld (2026-06-30, migraties 0031/0032/0033)

- **Migratie 0031** (`fn_groep_lid_trust_scores` SECURITY DEFINER):
  beheerders kunnen via RPC trust-scores van leden ophalen zonder dat
  RLS de query blokkeert. Retourneert 100 voor beheerder/hoofdbeheerder,
  `groep_trust_score` voor leden. **Uitgevoerd.**
- **Migratie 0032** (`user_profiles`-aanmaak-trigger): `fn_handle_new_user()`
  trigger op `auth.users` + backfill voor bestaande gebruikers. Nodig
  omdat `user_profiles` 0 rijen had (geen signup-trigger bestond).
  **Nog uit te voeren.**
- **Migratie 0033** (`groep_trust_score` kolom ontkoppelen):
  `groep_leden.groep_trust_score` (integer, default 75) toegevoegd.
  `fn_groep_trust_score_wijzigen` schrijft nu naar deze kolom, NIET
  naar `user_profiles.trust_score` — voorkomt dat groepsbeheerder de
  globale trust-score kan omzeilen. **Nog uit te voeren.**

## Buurtrapport + gemeente-dropdown fixes (2026-06-30)

- **`haalBuurtrapportGemeenten()`** (admin.js): nieuwe query die
  gemeenten ophaalt uit BEIDE `opt_in_buurt=true`-meldingen EN meldingen
  in een groep (`entries_groepen!inner`) — BuurtrapportGenerator toont
  nu een echte dropdown i.p.v. vrij tekstveld.
- **Groep-entries in buurtrapport**: `_vanGroep: true` vlag zorgt dat
  `filterVoorBuurtrapport` groep-meldingen doorlaat zonder `opt_in_buurt`.
- **`melder-overzicht` trust-score**: controlled input + expliciete
  "Opslaan"-knop toegevoegd (patroon gelijk aan GroepPage, voor mobiel).

## Zes bugfixes (2026-06-30)

- **CheckboxDropdown click-outside** (`components/melding/CheckboxDropdown.jsx`):
  paneel sluit nu ook bij klik buiten de component via een `mousedown`-listener
  in een `useEffect`. Eerder sloot het paneel alleen bij herklikken op de
  triggerknop.
- **Trust-score-verdeling 4 tiers** (`lib/meldingen/coordinatieStatistieken.js`):
  buckets aangepast van 5 → 4, in lijn met de DB-tiers uit migraties
  0022/0023/0024: `0-19`, `20-39`, `40-79`, `80-100`. Tests bijgewerkt.
- **Melder-overzicht tier-badge** (`components/coordinatie/CoordinatiePage.jsx`):
  elke melder-rij toont nu een gekleurde badge met tier-label naast het
  invoerveld. Nieuw gedeeld bestand `lib/meldingen/trustScore.js` bevat
  `trustScoreTier(score)` (rood/oranje/blauw/groen).
- **GroepPage trust-score badges** (`components/groepen/GroepPage.jsx`):
  beheerders/hoofdbeheerders zien per lid een gekleurde badge (score + tier)
  in de ledenlijst. Data via nieuwe helper `haalTrustScoresVoorLeden(userIds)`
  in `lib/groepen/groepLeden.js` — werkt via user_profiles RLS (alleen
  admin/coordinator ziet alle profielen; gewone beheerder ziet alleen eigen).
- **Groepsdossier-export** (`components/groepen/GroepPage.jsx`): nieuwe
  Collapsible "📦 Groepsdossier exporteren" zichtbaar voor beheerder/
  hoofdbeheerder. Gebruikt `haalGedeeldeMeldingenVoorGroepExport()` (brede
  entry-query, nieuw in `lib/groepen/groepen.js`), `entryNaarExportMelding()`,
  `laadBijlagenVanSupabase()`, `genereerDossierHTML()`, `openDossierPDF()`.
  Titel dossier: "Groepsdossier — {groepsnaam}". Rolcontrole via nieuw
  `magGroepsdossierExporteren()` in `lib/groepen/rollen.js`.
- **RFC 3161 diagnose** (Taak 6, geen code-wijziging): `rfc3161` staat correct
  in `laadVanSupabase()`. Scenario (a): opgeslagen in Supabase. De sync-code
  (`entries.js`) bewaart het volledige `{ token_b64, timestamp, serial, tsa,
  hash_input }`-object; de display-code verwacht dit formaat en leest het
  correct terug. Dev-waarschuwing `Geen TSR ontvangen` is normaal: Edge
  Function draait niet lokaal. Geen fix nodig.

## KNMI weerdata-integratie hersteld (2026-06-30)

- **`lib/weather/knmi.js` herschreven**: primaire bron is nu KNMI Open Data
  EDR met de nieuwe collectie `10-minute-in-situ-meteorological-observations`
  (vervangt de gedeprecieerde `observations`-collectie die per 29-09-2025 geen
  updates meer ontvangt). Authorization header: kale API-sleutel, geen
  Bearer-prefix. Stationsbepaling via `/locations?bbox=...`, data ophalen via
  `/locations/{id}?datetime={start}/{eind}`. CoverageJSON-parsing:
  `coverages[0].ranges.{param}.values`. Parameters: `dd` (windrichting),
  `ff` (windsnelheid m/s), `ta` (temperatuur), `rh` (luchtvochtigheid),
  `RH` (neerslag mm/10min).
- **Fallback ERA5** ingebouwd: als geen API-sleutel aanwezig is, of als KNMI
  EDR faalt (timeout/fout), valt de functie transparant terug op Open-Meteo
  ERA5/archief. De fallback gebruikt de actuele parameter-namen
  (`wind_speed_10m`, `wind_direction_10m`, `relative_humidity_2m`) i.p.v.
  de verouderde namen die de vorige versie gebruikte.
- **`laadKNMIKey()`/`slaKNMIKeyOp()`** zijn nu functioneel (localStorage
  `knmi_api_key`) — waren eerder no-ops waardoor de key-input in de UI niets
  deed.
- **`KNMIInstellingen.jsx`** UI bijgewerkt: beschrijft nu het primaire/
  fallback-pad transparant, geeft feedback of er een sleutel ingesteld is.
- **AbortController timeout** toegevoegd: 10s voor KNMI EDR, 8s voor ERA5.
- **Foutlogging verbeterd**: HTTP-status + eerste 120 tekens van het
  response-body gelogd bij mislukte aanroepen.
- **Geen wijziging aan `openMeteo.js`** (live invoer bij melden) — die module
  blijft onafhankelijk (zie DECISIONS.md "Weerdata gesplitst over drie
  bronnen").

## Verdamping/blootstelling, incrementele sync, dode code (2026-06-30)

- **Verdampings-/blootstellingsrisico-indicator in `lib/meldingen/spuitpatroon.js`**:
  drie nieuwe indicatoren toegevoegd aan `analyseerSpuitpatroon()`, elk
  score +1 / kleur `info`:
  - **Temperatuur > 25°C** — erkende blootstellingsfactor; geen wettelijke
    spuitnorm maar hoge temperatuur vergroot verdampingssnelheid.
  - **RV < 45%** — droge lucht versnelt verdamping van middelen van gewas
    en bodem. Complement op de bestaande RV > 85%-check (trage verdamping).
  - **Pasquill-klasse E of F** — stabiele atmosfeer (weinig verticale
    menging); berekend inline via `berekenPasquillKlasse()` op
    windsnelheid + cloud_cover + is_day uit `melding.weather`. Stabiele
    klassen houden spuitnevel laag bij de grond in de woonomgeving.
  Alle drie zijn nadrukkelijk geframed als omstandighedenfeit, niet als
  normoverschrijding — er is geen wettelijke drempelwaarde voor deze
  factoren (anders dan de windnorm ≤18 km/h).
- **`lib/drift/berekening.js` verwijderd** — was een volledige duplicaat
  van de FOCUS STEP-logica in `driftzone.js` (Leaflet-stijl [lat,lng]-
  punten i.p.v. OL [lng,lat]), nergens geïmporteerd.
- **Incrementele sync `laadVanSupabase()`** (`lib/supabase/entries.js`):
  bij elke succesvolle sync wordt een checkpoint opgeslagen in
  `localStorage` (`spuitlogger_sync_cp_{user.id}`). Volgende syncs
  voegen `.gte('updated_at', checkpoint)` toe aan de query, zodat alleen
  gewijzigde entries worden opgehaald. `force = true` slaat de checkpoint
  over en haalt alles op (bestaand gedrag). `entries.updated_at` heeft
  trigger `entries_updated_at` (geverifieerd via `pg_trigger`
  2026-06-30). De checkpoint wordt vóór de query opgekomen
  (`syncStartedAt`) zodat een race-conditie (entries gewijzigd tussen
  query en opslaan) de volgende sync niet benadeelt.

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
  `MeldingenLijst.jsx` is niet meer aanwezig (was dead code, inmiddels
  verwijderd).
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

Migraties **0001 t/m 0029 zijn uitgevoerd**; 0030 staat klaar maar
nog niet uitgevoerd in Supabase (zie NEXT_STEPS.md):
- 0025: spuitregister-brief, client-only placeholder
- 0026: CHECK-constraint op `user_roles.role` (toegestane waarden)
- 0027: `fn_trust_score_actie_bonus` en `trust_score_events.entry_id`
  van `bigint` naar `text` — `entries.id` is text (`'DL-…'`), de bigint
  veroorzaakte "function does not exist" bij elke melding-sync
- 0028: lokale variabele `delta` → `v_delta` in `fn_trust_score_actie_bonus`
  — kolom `delta` in `trust_score_events` en variabele `delta` gaven
  "column reference is ambiguous" bij de `SUM(delta)`-subquery
- 0029: `fn_entry_zichtbaar_voor_groepslid()` (SECURITY DEFINER) vervangt
  de directe `entries_groepen`-join in de `entries_select_groepslid` RLS-
  policy — voorkomt "infinite recursion in policy for entries_groepen" bij
  DELETE door een groepbeheerder (zelfde patroon als `fn_is_groepslid`)
- 0030 (nog uit te voeren): RLS op `attachments`-tabel +
  Storage-bucket-policies `spuitlog-bijlagen` voor
  admin/coordinator/groepslid-hoog bijlagen-toegang

Nieuwe migraties na 0030 toevoegen op nummer 0031.

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

## CoordinatiePage — gemeente-backfill en buurtrapport (2026-06-29)

- **Rate limiting backfill** (`CoordinatiePage.jsx`): de gemeente-backfill-
  loop wachtte niet tussen PDOK-aanroepen — bij grote backlogs (100+
  meldingen) liep dit tegen 429-throttling aan. Nu 200ms delay tussen elke
  aanroep (`await new Promise(r => setTimeout(r, 200))`).
- **Buurtrapport `rapport.gebied` fix** (`BuurtrapportGenerator.jsx`):
  `rapport.postcodegebied` hernoemd naar `rapport.gebied` zodat
  `genereerBuurtrapportHTML()` (die `gebied` destructuurt) de gemeente-naam
  correct toont in titel en tabelrij (was: `undefined`).
- **Buurtdossier rapport-JSON fix** (`admin.js` `maakBuurtdossier`):
  `rapport_json: dossier.rapportJson` (altijd `undefined`) →
  `rapport_json: dossier` — de "Eerder gegenereerd"-knop laadde altijd een
  leeg rapport; nu wordt het volledige rapport-object opgeslagen.
- **Info-melding zonder gemeente** (`BuurtrapportGenerator.jsx`):
  `telOptInEntriesZonderGemeente()` telt bij component-load het aantal
  opt_in_buurt meldingen zonder gemeente. Als dat > 0 is, toont een
  info-blokje hoeveel meldingen buiten het rapport vallen en verwijst naar
  de backfill-knop.

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
