# Volgende stappen — Constatum

Alleen openstaande werkzaamheden. Afgeronde taken hier verwijderen, niet
laten staan met een ✅. Bij twijfel of iets nog open is: verifiëren tegen
de code, niet tegen het geheugen van een eerdere sessie.

## Hoog

- **Gebeurtenissen-clustering (2026-07-01, twee fixes) — Groepen-kant
  nog in de echte UI controleren.** Persoonlijke Tijdlijn is bevestigd
  werkend door de gebruiker (echte data van vandaag, W-543/W-303,
  110m/25min uit elkaar, clustert nu correct). Groepen-kant nog niet
  bevestigd in de echte UI (wel los getest op kernlogica-niveau):
  - Met een niet-beheerder-lid (of trust score < 80): meerdere
    meldingen op hetzelfde/aangrenzend perceel binnen 8u moeten als 1
    gebeurtenis verschijnen, zonder dat exacte locatie/perceelnummer
    voor zo'n lager-trust-lid alsnog zichtbaar wordt (alleen de
    koppeling is gefixt, niet de redactie).
  - Meldingen van meerdere leden moeten ook combineren tot 1 gebeurtenis
    (`aantalMelders` > 1).
- **Deel-app-knop (2026-07-01) op een echt mobiel toestel testen.**
  Lokaal/Playwright heeft geen `navigator.share`, dus alleen het
  klembord-kopieer-pad is getest. Controleer op een telefoon dat de
  systeem-deelkeuze verschijnt en dat "Delen" in die keuze een
  bruikbare link doorgeeft.
- **Beslissen of de neutrale AV-v2.0-terminologie (Waarneming/Logboek/
  Gebiedsdossier/Betrokkene) ook elders in de UI moet komen, of dat AV +
  Handleiding de enige twee plekken blijven.** Nu bewust beperkt tot die
  twee bestanden (zie DECISIONS.md) — Tijdlijn, Dashboard, Export,
  Groepen-pagina's, `MeldingForm.jsx` (teler-veld) en `melderCode()`
  zeggen nog steeds "melding"/"dossier"/"teler". Dit is een expliciete
  productbeslissing, geen automatische vervolgtaak.
- **Crash-bij-uitloggen (2026-07-01) verifiëren tegen een echte,
  ingelogde Supabase-sessie.** Reden: de exacte oorzaak kon niet met
  zekerheid herleid worden uit de geminificeerde productie-stacktrace
  (lokaal staat `SUPABASE_ENABLED` altijd op `false`, dus dit pad is
  nooit lokaal getest — zelfde patroon als de eerdere freeze-bij-eerste-
  login-bug). Er is nu wel een `ErrorBoundary` (vangt de crash op i.p.v.
  zwart scherm) + `build.sourcemap: true` (leesbare toekomstige
  stacktraces) — controleer of de crash zich nog voordoet, en zo ja,
  gebruik de sourcemap om de echte regel te vinden.
- **Dashboard-groepsfilter (2026-07-01, herzien) en Groepen
  Recent/Tijdlijn testen met echte groepsdata.** Kon niet volledig
  visueel geverifieerd worden lokaal (geen Supabase-sessie/groepen
  beschikbaar in dev; wel getest met een tijdelijk testharnas en
  nepdata). Controleer: de groepsdropdown in `DashboardKaart.jsx`'s
  filterbalk toont de juiste groepen, de kaart zelf toont daadwerkelijk
  de meldingen van de gekozen groep (niet meer eigen+buurt), klikken op
  een marker opent `GroepMeldingDetailModal` met de juiste trust-tier-
  redactie, trust-tier-redactie in de Recent/Tijdlijn-lijst eronder, en
  dat clustering (`GroepClusterKaart`) zich normaal gedraagt bij
  meerdere meldingen op hetzelfde perceel.
- **Achteraf-delen-met-groep (2026-07-01) testen met een echte
  gesynchroniseerde melding + groepslidmaatschap.** Kon niet lokaal
  geverifieerd worden (geen Supabase-sessie in dev). Controleer: de
  "📤 Delen met groep"-kaart in `MeldingDetailModal.jsx` toont alleen
  groepen met `deel_meldingen` aan, de checkbox-toggle voegt/verwijdert
  daadwerkelijk een `entries_groepen`-rij, en de melding verschijnt
  daarna in de `GroepMeldingenLijst` van die groep.
- **OG-preview werkt op Signal/Discord, nog niet op WhatsApp — keuze
  nodig over primair domein.** De vercel.json-rewrite-fix werkt
  (bevestigd: `icon-512.png` geeft nu `Content-Type: image/png`
  terug). Vermoedelijke resterende oorzaak: `https://constatum.nl`
  (zonder www) redirect (308) naar `https://www.constatum.nl` en toont
  zelf geen enkele meta-tag; WhatsApp's crawler volgt cross-domain-
  redirects minder betrouwbaar dan Discord/Signal. Twee opties, een
  productbeslissing voor de gebruiker (geen codewijziging mogelijk
  zonder een keuze):
  1. Apex-domein (`constatum.nl`) primair maken in de Vercel-
     domeininstellingen i.p.v. `www.constatum.nl` — dan is er geen
     redirect meer nodig voor het kale domein. Vereist ook
     `og:url`/`og:image`/`twitter:image` in `index.html` aan te passen
     naar het apex-domein.
  2. Www-redirect laten staan, maar bewust altijd de `www.`-link delen/
     aanraden (minder robuust, mensen typen/delen vaak de kale variant).
  - Test na een keuze met de Facebook Sharing Debugger
    (developers.facebook.com/tools/debug/, zelfde crawler-familie als
    WhatsApp) op zowel `constatum.nl` als `www.constatum.nl` — deze
    tool toont exact wat de crawler ziet en heeft een "Scrape
    Again"-knop om een eventuele stale cache van vóór de fix te
    forceren te verversen.
  - PWA "Zet op beginscherm"/service-worker-registratie ook nog
    controleren (was mogelijk stilzwijgend getroffen door dezelfde
    rewrite-bug, nog niet apart bevestigd).
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
- **Migraties 0030 t/m 0035 uitvoeren in Supabase SQL-editor** (in volgorde):
  - **0030**: RLS op `attachments`-tabel + Storage-policies `spuitlog-bijlagen`.
    Test daarna: coordinator/admin opent melding van ander → foto's laden?
    Groepslid met score ≥80 opent groepsmelding van ander → foto's laden?
  - **0031**: `fn_groep_lid_trust_scores` (SECURITY DEFINER).
  - **0032**: `user_profiles`-aanmaak-trigger + backfill bestaande gebruikers.
  - **0033**: `groep_leden.groep_trust_score`-kolom ontkoppelen van globale score.
  - **0034**: kwetsbare groepen (AVG art. 9) profielkolommen.
  - **0035**: pg_cron-job voor auto-cleanup verlopen uitnodigingslinks (dagelijks
    04:00 UTC). Controleer na uitvoeren: `SELECT * FROM cron.job WHERE jobname = 'cleanup_verlopen_uitnodigingen';`
- **Provincie/gemeente backfillen-knop draaien op CoordinatiePage.**
  Migratie 0013 (`gemeente`/`provincie`-kolommen op `entries`) is
  uitgevoerd — nieuwe meldingen krijgen deze velden automatisch.
  Historische meldingen missen ze nog; eenmalig aanvullen via de
  backfill-knop in de "Filter op provincie/gemeente"-kaart.
  Rate limiting (200ms/aanroep) is per 2026-06-29 in orde; de knop
  kan nu ook voor grote backlogs veilig gedraaid worden.

## Middel

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

- **Geo-verificatie EXIF implementeren** (optionele trust-score-bonus).
  Infrastructuur is compleet: `extractEXIF()` leest al `gps_lat`, `gps_lng`
  en `datetime_original` vóór het strippen. Enige ontbrekende stap:
  `verifieerEXIFLocatie(exif, meldingLat, meldingLng, meldingTimestamp)`
  toevoegen in `lib/bewijsmateriaal/exif.js` (haversine-afstand ≤~500m +
  tijdsverschil ≤15-30 min). Resultaat opslaan als `bestand.exif_verificatie`
  en als bonus meewegen in trust-score. iOS-kanttekening: iOS verwijdert EXIF
  vóór overdracht via systeem-share — verificatie werkt dan niet.

- **Domein en externe accounts bijwerken naar constatum.nl**:
  - DNS constatum.nl koppelen aan Vercel
  - Vercel project hernoemen / domeinkoppeling instellen
  - E-mailadressen `info@constatum.nl` en `privacy@constatum.nl` aanmaken
  - Drie .docx juridische documenten (spuitregisterbrief, AV, privacy) herschrijven

