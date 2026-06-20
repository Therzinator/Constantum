import { idbGetBijlagen } from '../storage/indexedDB.js';
import { melderCode } from '../../utils/format.js';
import { APP_VERSION_CLIENT } from '../version.js';

// Genereert een printbare HTML-pagina van het volledige dossier — opent in
// een nieuw venster waar de gebruiker zelf "Afdrukken als PDF" kiest (geen
// auto-print, zie legacy-regel "Geen auto-print — print knop in header").
// Geen externe lettertypen/kaarttegels als base64 (dat was een CORS-
// workaround specifiek voor de oude single-file deployment); deze pagina
// gebruikt systeemlettertypen en toont coördinaten in tekst i.p.v. een kaart.

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
  const fotos = (m.bestanden || [])
    .filter((f) => !f.type?.startsWith('video/'))
    .map((f) => f.thumbnail || idbBijlagen.find((b) => b.hash === f.hash || b.name === f.name)?.dataUrl)
    .filter(Boolean);

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
        <tr><td>SHA-256 hash</td><td class="mono">${escapeHTML(m.hash)}</td></tr>
        <tr><td>RFC 3161 tijdstempel</td><td>${m.rfc3161
          ? `✓ ${escapeHTML(new Date(m.rfc3161.timestamp).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }))} — TSA: ${escapeHTML(m.rfc3161.tsa)}`
          : '⚠ Geen tijdstempel beschikbaar'}</td></tr>
      </table>

      ${fotos.length ? `<h4>Foto's (${fotos.length})</h4><div class="foto-grid">${fotos.map((src) => `<img src="${src}" />`).join('')}</div>` : ''}
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
  .foto-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .foto-grid img { width: 140px; height: 140px; object-fit: cover; border: 1px solid #ccc; }
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
