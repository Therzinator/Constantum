# Volgende stappen — Constatum

Alleen openstaande werkzaamheden. Afgeronde taken hier verwijderen, niet
laten staan met een ✅. Bij twijfel of iets nog open is: verifiëren tegen
de code, niet tegen het geheugen van een eerdere sessie.

## Hoog

- **Achteraf-delen-met-groep (2026-07-01) testen met een echte
  gesynchroniseerde melding + groepslidmaatschap.** Kon niet lokaal
  geverifieerd worden (geen Supabase-sessie in dev). Controleer: de
  "📤 Delen met groep"-kaart in `MeldingDetailModal.jsx` toont alleen
  groepen met `deel_meldingen` aan, de checkbox-toggle voegt/verwijdert
  daadwerkelijk een `entries_groepen`-rij, en de melding verschijnt
  daarna in de `GroepMeldingenLijst` van die groep.
- **Een gebruiker een `coordinator`-rol toekennen om te testen.** Reden:
  migraties 0008-0011 zijn op 2026-06-21 uitgevoerd (bevestigd, geen
  foutmeldingen), maar er is nog geen account met de rol `coordinator`;
  `user_roles.role = 'coordinator'` moet handmatig gezet worden (geen UI
  hiervoor) om de CoördinatiePage-toegang/Heatmap-toggle te verifiëren.
  De CHECK-constraint (migratie 0026) staat en laat `'coordinator'` toe.
- **Provincie/gemeente backfillen-knop draaien op CoordinatiePage.**
  Migratie 0013 (`gemeente`/`provincie`-kolommen op `entries`) is
  uitgevoerd — nieuwe meldingen krijgen deze velden automatisch.
  Historische meldingen missen ze nog; eenmalig aanvullen via de
  backfill-knop in de "Filter op provincie/gemeente"-kaart.
  Rate limiting (200ms/aanroep) is per 2026-06-29 in orde; de knop
  kan nu ook voor grote backlogs veilig gedraaid worden.

## Middel

- **Sentry-account/project aanmaken + DSN instellen (2026-07-01).** De
  code-integratie is klaar (`@sentry/react` toegevoegd, `lib/monitoring/
  sentry.js`, aanroep in `main.jsx`, `ErrorBoundary.jsx` stuurt gevangen
  render-fouten door) maar staat **uit** zolang er geen DSN is: `initSentry()`
  doet niets als `VITE_SENTRY_DSN` ontbreekt (zelfde patroon als
  `SUPABASE_ENABLED`), dus dit breekt niets als het overgeslagen wordt.
  Om te activeren: account/project aanmaken op sentry.io (of self-hosted/
  EU-region, een keuze i.v.m. AVG), en de env var `VITE_SENTRY_DSN` zetten
  in Vercel (en lokaal in `.env` als je fouten ook lokaal wil zien — staat
  sowieso uit op `localhost`, zie `IS_LOCALHOST`-check in `sentry.js`).
  Bewust nog GEEN performance-tracing/session-replay geactiveerd (zie
  DECISIONS.md) — dat is een aparte, latere keuze.
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

- **Domein en externe accounts bijwerken naar constatum.nl**:
  - DNS constatum.nl koppelen aan Vercel
  - Vercel project hernoemen / domeinkoppeling instellen
  - E-mailadressen `info@constatum.nl` en `privacy@constatum.nl` aanmaken
  - Drie .docx juridische documenten (spuitregisterbrief, AV, privacy) herschrijven

