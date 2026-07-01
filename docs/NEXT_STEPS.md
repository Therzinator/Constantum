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

- **Sentry live in productie testen met een echte fout (2026-07-01).**
  Account/project aangemaakt (via GitHub-login, EU-regio: `ingest.de.sentry.io`),
  `VITE_SENTRY_DSN` gezet in Vercel + lokale `.env`, en geredeployed. Nog
  niet bevestigd dat er daadwerkelijk een fout aankomt in het Sentry-
  dashboard (geen manier om dit vanuit deze sessie te verifiëren — Sentry-
  dashboard-toegang is niet beschikbaar). Test: forceer een render-fout op
  de live site (of gebruik `Sentry.captureException(new Error('test'))`
  tijdelijk in de devtools-console op de live URL) en controleer of hij
  verschijnt in het Sentry-project.
- **`useToggleableLayer()`-hook voor DashboardKaart.jsx.** De vijf
  laag-toggle-functies (luchtfoto/drift/Natura2000/percelen/heatmap) zijn
  structureel bijna identiek. De PDOK-fetch-duplicatie is al opgelost
  (`lib/pdok/wfsClient.js`, 2026-06-21) — deze hook-generalisatie is
  bewust nog niet gedaan: hogere kans op een subtiele regressie in een
  component die al 594 regels is, zonder browser-test niet veilig te
  verifiëren binnen deze sessie.

## Laag

- **Live-burst-drempel (15 meldingen/uur, migratie 0037) monitoren.**
  Geschatte waarde, geen gemeten — controleer na verloop van tijd via
  `trust_score_events`/`entries.visibility='shadow'` of legitieme
  gebruikers hierdoor onterecht geraakt worden (te streng) of dat
  duidelijke misbruikpatronen er juist doorheen glippen (te soepel), en
  stel bij in `fn_entries_set_visibility` indien nodig.
- **Domein en externe accounts bijwerken naar constatum.nl**:
  - DNS constatum.nl koppelen aan Vercel
  - Vercel project hernoemen / domeinkoppeling instellen
  - E-mailadressen `info@constatum.nl` en `privacy@constatum.nl` aanmaken
  - Drie .docx juridische documenten (spuitregisterbrief, AV, privacy) herschrijven

