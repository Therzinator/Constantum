# Volgende stappen — Constatum

Alleen openstaande werkzaamheden. Afgeronde taken hier verwijderen, niet
laten staan met een ✅. Bij twijfel of iets nog open is: verifiëren tegen
de code, niet tegen het geheugen van een eerdere sessie.

## Hoog

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
- **OG-deelicoon (2026-07-01) live verifiëren na deploy.** De
  waarschijnlijke oorzaak van het "verdwenen" deelicoon (relatief pad
  i.p.v. absolute URL) is gecorrigeerd, maar dit is niet te testen
  zonder een echte productie-deploy + een link delen in WhatsApp/
  Telegram/Discord/iMessage. Gebruik zo nodig een OG-debugtool
  (bv. Facebook Sharing Debugger of metatags.io) om te controleren of
  `https://www.constatum.nl/icons/icon-512.png` daadwerkelijk als
  preview-afbeelding wordt opgepikt.
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

- **`useToggleableLayer()`-hook voor DashboardKaart.jsx** — de vijf
  laag-toggle-functies zijn structureel bijna identiek; generalisatie is bewust
  nog niet gedaan (594 regels, regressierisico zonder browser-test).

- **Kaartweergave groepsfilter (2026-07-01) testen met echte
  groepsdata.** `GroepDashboardKaart.jsx` (nieuw, lazy-loaded) is
  toegevoegd aan `GroepMeldingenLijst.jsx` — verschijnt dus zowel op het
  Dashboard-groepsfilter als op de Groepen-detailpagina. Getest met
  nepdata via een tijdelijk testharnas (markers plotten correct,
  klikken roept `onMeldingSelecteren` met de juiste melding aan, geen
  console-fouten, hoofdbundel blijft ~895KB dankzij lazy-loading) —
  niet getest met een echte, gesynchroniseerde groep. Controleer ook
  dat een melding zonder zichtbare locatie (lage trust-tier) terecht
  niet op de kaart verschijnt, en dat bij nul zichtbare locaties de
  leeg-melding getoond wordt i.p.v. een kale kaart.
