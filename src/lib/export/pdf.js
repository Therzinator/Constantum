import { idbGetBijlagen } from '../storage/indexedDB.js';
import { melderCode } from '../../utils/format.js';
import { APP_VERSION_CLIENT } from '../version.js';

// Genereert een printbare HTML-pagina van het volledige dossier — opent in
// een nieuw venster waar de gebruiker zelf "Afdrukken als PDF" kiest (geen
// auto-print, zie legacy-regel "Geen auto-print — print knop in header").
// Geen externe lettertypen als base64 (CORS-workaround specifiek voor de
// oude single-file deployment, hier niet relevant) — wel een kaartweergave
// per melding, als PNG-dataURL "bevroren" vóór het openen van dit venster
// (zie meldingKaartAfbeelding.js; dit printvenster zelf heeft geen React/OL).

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const TYPE_LABEL = {
  spuitactiviteit: 'Spuitactiviteit', drift: 'Drift/nevel', geur: 'Chemische geur',
  geluid: 'Geluid', gezondheid: 'Gezondheid', overig: 'Overig', nachtelijk: 'Nachtelijke activiteit'
};

async function meldingNaarHTML(m) {
  const idbBijlagen = await idbGetBijlagen(m.id);
  // Voorheen werd hier f.thumbnail (extra gecomprimeerd, max 800px) als
  // EERSTE optie getoond — de volledige, alleen EXIF/GPS-gestripte versie
  // uit IndexedDB (idbSaveBijlage, zie useNieuweMeldingForm.js) bestond al,
  // maar kwam nooit in het dossier terecht zolang er een thumbnail was.
  // Nu krijgt die volledige versie voorrang; thumbnail/f.dataUrl zijn alleen
  // nog een fallback (bv. oudere meldingen, of IDB-data die niet meer
  // beschikbaar is).
  const fotos = (m.bestanden || [])
    .filter((f) => !f.type?.startsWith('video/'))
    .map((f) => ({
      src: idbBijlagen.find((b) => b.hash === f.hash || b.name === f.name)?.dataUrl || f.dataUrl || f.thumbnail,
      hash: f.hash
    }))
    .filter((f) => f.src);
  // Dynamic import i.p.v. een top-level import — meldingKaartAfbeelding.js
  // trekt OpenLayers mee (alleen voor het "bevriezen" van een kaart-PNG),
  // dat hoort niet in de hoofdbundel voor wie nooit een dossier exporteert.
  const { genereerMeldingKaartAfbeelding } = await import('./meldingKaartAfbeelding.js');
  const kaartAfbeelding = await genereerMeldingKaartAfbeelding(m).catch(() => null);
  const toontWoningPin = m.afstand_woning_lat != null && m.afstand_woning_lng != null;

  const types = (m.types?.length ? m.types : [m.type]).map((t) => TYPE_LABEL[t] || t).join(', ');

  return `
    <section class="melding">
      <h3>${escapeHTML(types)} — ${escapeHTML(m.date)} ${escapeHTML(m.time)}</h3>
      <table class="meta-table">
        <tr><td>Melding-ID</td><td>${escapeHTML(m.id)}</td></tr>
        ${m.melder_email ? `<tr><td>Melder</td><td>${escapeHTML(melderCode(m.melder_email))}</td></tr>` : ''}
        <tr><td>Tijdstip (lokaal)</td><td>${escapeHTML(m.date)} ${escapeHTML(m.time)} (${escapeHTML(m.timezone || 'Europe/Amsterdam')})</td></tr>
        <tr><td>Tijdstip (UTC)</td><td>${escapeHTML(m.timestamp_utc)}</td></tr>
        ${m.gps?.lat ? `<tr><td>GPS-locatie</td><td>${m.gps.lat.toFixed(6)}°N, ${m.gps.lng.toFixed(6)}°E</td></tr>` : ''}
        ${m.afstand_woning != null ? `<tr><td>Afstand tot perceel met woonbestemming</td><td>${m.afstand_woning} m${m.afstand_woning < 50 ? ' — ONDER 50m NORM' : ''}</td></tr>` : ''}
        ${m.perceelnummer ? `<tr><td>Perceelnummer (BRK)</td><td>${escapeHTML(m.perceelnummer)}</td></tr>` : ''}
        ${m.bedrijfsnaam ? `<tr><td>Bedrijfsnaam teler</td><td>${escapeHTML(m.bedrijfsnaam)}</td></tr>` : ''}
        ${m.gewas ? `<tr><td>Gewas</td><td>${escapeHTML(m.gewas)}</td></tr>` : ''}
      </table>

      ${kaartAfbeelding ? `
      <h4>Kaartweergave</h4>
      <img class="melding-kaart" src="${kaartAfbeelding}" />
      <p class="kaart-legenda">🚜 Spuitactiviteit (windvector/driftkegel) · 🟢 Natura 2000 · 🟠 Overige kwetsbare locaties (zorg/onderwijs/speeltuin)${toontWoningPin ? ' · 🔵 Woning' : ''}
        ${!toontWoningPin && m.afstand_woning != null ? ' — locatie van de woning is bij deze melding niet opgeslagen, dus niet op de kaart gevisualiseerd' : ''}</p>` : ''}

      <h4>Omschrijving</h4>
      <p>${escapeHTML(m.description)}</p>

      ${m.drift_waarneming?.length ? `<h4>Drift &amp; overlast</h4><p>${m.drift_waarneming.map(escapeHTML).join(' · ')}</p>` : ''}
      ${m.gezondheidsklachten?.length ? `<h4>Gezondheidsklachten (toestemming: ${m.gezondheid_toestemming ? 'ja' : 'nee'})</h4><p>${m.gezondheidsklachten.map(escapeHTML).join(', ')}</p>` : ''}

      ${m.weather?.wind_speed != null ? `
      <h4>Weerdata (${escapeHTML(m.weather.source)})</h4>
      <table class="meta-table">
        <tr><td>Wind</td><td>${m.weather.wind_speed} km/h, richting ${m.weather.wind_dir}° (${escapeHTML(m.richting_compass || '')})</td></tr>
        <tr><td>Windstoten</td><td>${m.weather.wind_gusts} km/h</td></tr>
        <tr><td>Temperatuur</td><td>${m.weather.temperature}°C</td></tr>
        <tr><td>Luchtvochtigheid</td><td>${m.weather.humidity}%</td></tr>
        <tr><td>Neerslag</td><td>${m.weather.precipitation} mm</td></tr>
        ${m.weather.pasquill ? `<tr><td>Pasquill stabiliteitsklasse</td><td>${escapeHTML(m.weather.pasquill.klasse)} (${escapeHTML(m.weather.pasquill.label)})</td></tr>` : ''}
      </table>` : ''}

      <h4>Integriteitsverificatie</h4>
      <table class="meta-table">
        <tr><td>SHA-256 hash (meldinggegevens)</td><td class="mono">${escapeHTML(m.hash)}</td></tr>
        <tr><td>RFC 3161 tijdstempel</td><td>${m.rfc3161
          ? `✓ ${escapeHTML(new Date(m.rfc3161.timestamp).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }))} — TSA: ${escapeHTML(m.rfc3161.tsa)}`
          : '⚠ Geen tijdstempel beschikbaar'}</td></tr>
      </table>
      <p class="hash-toelichting">De hash hierboven verifieert de meldinggegevens (tijd, locatie, omschrijving), niet de foto's — zie per foto de eigen hash van het ORIGINEEL geüploade bestand, vóór de verwijdering van EXIF/GPS-metadata.</p>

      ${fotos.length ? `<h4>Foto's (${fotos.length})</h4><div class="foto-grid">${fotos.map((f) => `<figure class="foto-item"><img src="${f.src}" />${f.hash ? `<figcaption class="mono">SHA-256 origineel: ${escapeHTML(f.hash)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
    </section>`;
}

export async function genereerDossierHTML(meldingen, locatieLabel) {
  const secties = await Promise.all(meldingen.map(meldingNaarHTML));
  const datums = meldingen.map((m) => new Date(m.timestamp_local)).sort((a, b) => a - b);

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>SpuitLogger Dossier — ${escapeHTML(locatieLabel || '')}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; max-width: 800px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 20px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h3 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid #999; padding-bottom: 4px; }
  h4 { font-size: 12px; margin: 12px 0 4px; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .meta-table td { padding: 2px 6px; border-bottom: 1px solid #eee; font-size: 12px; }
  .meta-table td:first-child { color: #666; width: 200px; }
  .mono { font-family: 'Courier New', monospace; font-size: 10px; word-break: break-all; }
  .melding-kaart { width: 100%; max-width: 680px; border: 1px solid #ccc; display: block; }
  .kaart-legenda { font-size: 10px; color: #666; margin: 4px 0 12px; }
  .foto-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .foto-item { margin: 0; width: 140px; }
  .foto-item img { width: 140px; height: 140px; object-fit: cover; border: 1px solid #ccc; display: block; }
  .foto-item figcaption { font-size: 7px; word-break: break-all; color: #888; margin-top: 2px; }
  .hash-toelichting { font-size: 10px; color: #666; margin: 0 0 8px; }
  .melding { page-break-inside: avoid; }
  .print-knop { margin: 16px 0; padding: 8px 16px; cursor: pointer; }
  @media print { .print-knop { display: none; } }
</style>
</head>
<body>
  <button class="print-knop" onclick="window.print()">🖨️ Afdrukken als PDF</button>
  <h1>SpuitLogger — Juridisch dossier</h1>
  <table class="meta-table">
    <tr><td>Locatie</td><td>${escapeHTML(locatieLabel || 'Onbekend')}</td></tr>
    <tr><td>Aantal meldingen</td><td>${meldingen.length}</td></tr>
    <tr><td>Periode</td><td>${datums.length ? `${datums[0].toLocaleDateString('nl-NL')} — ${datums[datums.length - 1].toLocaleDateString('nl-NL')}` : '—'}</td></tr>
    <tr><td>Gegenereerd op</td><td>${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}</td></tr>
    <tr><td>SpuitLogger versie</td><td>${escapeHTML(APP_VERSION_CLIENT)}</td></tr>
  </table>
  ${secties.join('\n')}
</body>
</html>`;
}

export function openDossierPDF(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Pop-up geblokkeerd — sta pop-ups toe voor deze site en probeer opnieuw');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
