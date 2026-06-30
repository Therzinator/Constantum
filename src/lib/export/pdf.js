import { idbGetBijlagen } from '../storage/indexedDB.js';
import { melderCode } from '../../utils/format.js';
import { APP_VERSION_CLIENT } from '../version.js';

// Genereert een zelfstandige, interactieve HTML-pagina van het volledige dossier
// (geen externe afhankelijkheden — alle afbeeldingen zijn ingebedde data-URLs).
// Geschikt voor digitale overdracht aan een rechtbank, advocaat of notaris.

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const TYPE_LABEL = {
  spuitactiviteit: 'Spuitactiviteit', drift: 'Drift/nevel', geur: 'Chemische geur',
  geluid: 'Geluid', gezondheid: 'Gezondheid', overig: 'Overig', nachtelijk: 'Nachtelijke activiteit'
};

async function meldingNaarHTML(m, index) {
  const idbBijlagen = await idbGetBijlagen(m.id);

  const fotos = (m.bestanden || [])
    .filter((f) => !f.type?.startsWith('video/'))
    .map((f) => ({
      src: idbBijlagen.find((b) => b.hash === f.hash || b.name === f.name)?.dataUrl || f.dataUrl || f.thumbnail,
      hash: f.hash,
      naam: f.name
    }))
    .filter((f) => f.src);

  const videos = (m.bestanden || [])
    .filter((f) => f.type?.startsWith('video/'))
    .map((f) => ({ naam: f.name, hash: f.hash, grootte: f.size }));

  const { genereerMeldingKaartAfbeelding } = await import('./meldingKaartAfbeelding.js');
  const kaartAfbeelding = await genereerMeldingKaartAfbeelding(m).catch(() => null);
  const toontWoningPin = m.afstand_woning_lat != null && m.afstand_woning_lng != null;
  const types = (m.types?.length ? m.types : [m.type]).map((t) => TYPE_LABEL[t] || t).join(', ');
  const locatieRegel = [
    m.gps?.lat ? `${m.gps.lat.toFixed(6)}°N, ${m.gps.lng.toFixed(6)}°E` : null,
    m.gemeente || null
  ].filter(Boolean).join(' · ');

  const fotosHTML = fotos.length ? `
    <h4>Foto's (${fotos.length}) — klik om te vergroten</h4>
    <div class="foto-grid">
      ${fotos.map((f, fi) => `
        <figure class="foto-item" onclick="openLightbox(${index},${fi})" title="Klik om te vergroten">
          <img src="${f.src}" loading="lazy" />
          ${f.hash ? `<figcaption class="mono">SHA-256: ${escapeHTML(f.hash)}</figcaption>` : ''}
        </figure>`).join('')}
    </div>` : '';

  const videosHTML = videos.length ? `
    <h4>Video-bijlagen (${videos.length})</h4>
    <table class="meta-table">
      ${videos.map((v) => `<tr>
        <td>${escapeHTML(v.naam)}</td>
        <td class="mono">${v.hash ? `SHA-256: ${escapeHTML(v.hash)}` : '—'}</td>
      </tr>`).join('')}
    </table>
    <p class="hash-toelichting">Video's worden niet ingebed in het dossier vanwege bestandsgrootte. Leg de originele bestanden apart voor bij dit dossier.</p>` : '';

  return `
    <section class="melding" id="melding-${index}">
      <h3>${escapeHTML(types)} — ${escapeHTML(m.date)} ${escapeHTML(m.time)}</h3>
      <table class="meta-table">
        <tr><td>Melding-ID</td><td>${escapeHTML(m.id)}</td></tr>
        ${m.melder_email ? `<tr><td>Melder</td><td>${escapeHTML(melderCode(m.melder_email))}</td></tr>` : ''}
        <tr><td>Tijdstip (lokaal)</td><td>${escapeHTML(m.date)} ${escapeHTML(m.time)} (${escapeHTML(m.timezone || 'Europe/Amsterdam')})</td></tr>
        <tr><td>Tijdstip (UTC)</td><td>${escapeHTML(m.timestamp_utc)}</td></tr>
        ${locatieRegel ? `<tr><td>GPS-locatie</td><td>${escapeHTML(locatieRegel)}</td></tr>` : ''}
        ${m.gemeente ? `<tr><td>Gemeente</td><td>${escapeHTML(m.gemeente)}</td></tr>` : ''}
        ${m.provincie ? `<tr><td>Provincie</td><td>${escapeHTML(m.provincie)}</td></tr>` : ''}
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

      ${m.kwetsbare_groep_aanwezig ? `
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:8px 12px;margin:8px 0;font-size:12px;">
        <strong>⚠️ Kwetsbare bewoner(s) aanwezig bij deze waarneming</strong><br>
        <span style="color:#555;">De melder heeft aangegeven dat er kwetsbare personen (kinderen, ouderen, of personen met gezondheidskwetsbaarheden) in het huishouden aanwezig zijn. Dit is een erkende verzwarende omstandigheid bij beoordeling van pesticideblootstelling.</span>
      </div>` : ''}
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

      ${fotosHTML}
      ${videosHTML}

      <script>
        (function() {
          window._meldingFotos = window._meldingFotos || {};
          window._meldingFotos[${index}] = [${fotos.map((f) => JSON.stringify(f.src)).join(',')}];
        })();
      </script>
    </section>`;
}

function tocRegel(m, index) {
  const types = (m.types?.length ? m.types : [m.type]).map((t) => TYPE_LABEL[t] || t).join(', ');
  const gemeente = m.gemeente ? ` · ${m.gemeente}` : '';
  return `<li><a href="#melding-${index}">${escapeHTML(m.date)} ${escapeHTML(m.time)} — ${escapeHTML(types)}${escapeHTML(gemeente)}</a></li>`;
}

export async function genereerDossierHTML(meldingen, locatieLabel, gemeente = null) {
  const secties = await Promise.all(meldingen.map((m, i) => meldingNaarHTML(m, i)));
  const datums = meldingen.map((m) => new Date(m.timestamp_local)).sort((a, b) => a - b);
  const locatieRegel = [locatieLabel, gemeente].filter(Boolean).join(' · ');
  const tocHTML = meldingen.length > 1
    ? `<nav><h3 style="margin-top:0">Inhoudsopgave (${meldingen.length} meldingen)</h3><ol>${meldingen.map((m, i) => tocRegel(m, i)).join('')}</ol></nav>`
    : '';

  const LIGHTBOX_CSS = `
  .lightbox-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:9999; cursor:zoom-out; }
  .lightbox-overlay.actief { display:flex; align-items:center; justify-content:center; flex-direction:column; gap:12px; }
  .lightbox-overlay img { max-width:95vw; max-height:85vh; object-fit:contain; border:2px solid #fff; box-shadow:0 4px 40px rgba(0,0,0,0.8); }
  .lightbox-nav { display:flex; gap:16px; }
  .lightbox-nav button { background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.3); padding:8px 20px; font-size:14px; cursor:pointer; border-radius:4px; }
  .lightbox-nav button:hover { background:rgba(255,255,255,0.3); }
  .lightbox-caption { color:#ccc; font-size:11px; font-family:monospace; max-width:90vw; word-break:break-all; text-align:center; }
  .foto-item { cursor:zoom-in; transition:transform 0.1s; }
  .foto-item:hover { transform:scale(1.04); }`;

  const LIGHTBOX_JS = `
  var _lb = { mIdx: 0, fIdx: 0 };
  function openLightbox(mIdx, fIdx) {
    _lb.mIdx = mIdx; _lb.fIdx = fIdx;
    var fotos = (window._meldingFotos || {})[mIdx] || [];
    var src = fotos[fIdx];
    if (!src) return;
    document.getElementById('lb-img').src = src;
    document.getElementById('lb-cap').textContent = (fIdx+1) + ' / ' + fotos.length;
    document.getElementById('lightbox').classList.add('actief');
  }
  function closeLightbox() { document.getElementById('lightbox').classList.remove('actief'); }
  function lbNav(delta) {
    var fotos = (window._meldingFotos || {})[_lb.mIdx] || [];
    var n = (_lb.fIdx + delta + fotos.length) % fotos.length;
    openLightbox(_lb.mIdx, n);
  }
  function downloadHtml() {
    var blob = new Blob([document.documentElement.outerHTML], {type:'text/html;charset=utf-8'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spuitlogger-dossier-' + new Date().toISOString().split('T')[0] + '.html';
    a.click();
  }
  document.addEventListener('keydown', function(e) {
    if (!document.getElementById('lightbox').classList.contains('actief')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') lbNav(1);
    if (e.key === 'ArrowLeft') lbNav(-1);
  });`;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>SpuitLogger Dossier — ${escapeHTML(locatieRegel || '')}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; max-width: 800px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 20px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h3 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid #999; padding-bottom: 4px; }
  h4 { font-size: 12px; margin: 12px 0 4px; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
  nav { background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 16px 20px; margin: 16px 0; }
  nav ol { margin: 8px 0 0; padding-left: 20px; }
  nav li { margin: 4px 0; }
  nav a { color: #1a56db; text-decoration: none; font-size: 12px; }
  nav a:hover { text-decoration: underline; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .meta-table td { padding: 3px 6px; border-bottom: 1px solid #eee; font-size: 12px; }
  .meta-table td:first-child { color: #666; width: 200px; }
  .mono { font-family: 'Courier New', monospace; font-size: 10px; word-break: break-all; }
  .melding-kaart { width: 100%; max-width: 680px; border: 1px solid #ccc; display: block; }
  .kaart-legenda { font-size: 10px; color: #666; margin: 4px 0 12px; }
  .foto-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0; }
  .foto-item { margin: 0; }
  .foto-item img { width: 180px; height: 180px; object-fit: cover; border: 2px solid #ccc; display: block; border-radius: 3px; }
  .foto-item figcaption { font-size: 7px; word-break: break-all; color: #888; margin-top: 3px; max-width: 180px; }
  .hash-toelichting { font-size: 10px; color: #666; margin: 0 0 8px; }
  .melding { page-break-inside: avoid; border-top: 2px solid #111; padding-top: 8px; margin-top: 16px; }
  .knop-rij { display: flex; gap: 10px; margin: 16px 0; flex-wrap: wrap; }
  .knop-rij button { padding: 8px 16px; cursor: pointer; border: 1px solid #999; background: #f5f5f5; border-radius: 3px; font-size: 13px; }
  .knop-rij button:hover { background: #e0e0e0; }
  ${LIGHTBOX_CSS}
  @media print {
    .knop-rij { display: none; }
    .lightbox-overlay { display: none !important; }
    nav { background: #fff; }
  }
</style>
</head>
<body>

<div id="lightbox" class="lightbox-overlay" onclick="if(event.target===this)closeLightbox()">
  <img id="lb-img" src="" alt="Bijlage" />
  <div class="lightbox-nav">
    <button onclick="lbNav(-1)">◀ Vorige</button>
    <button onclick="closeLightbox()">✕ Sluiten</button>
    <button onclick="lbNav(1)">Volgende ▶</button>
  </div>
  <div id="lb-cap" class="lightbox-caption"></div>
</div>

<div class="knop-rij">
  <button onclick="window.print()">🖨️ Afdrukken als PDF</button>
  <button onclick="downloadHtml()">💾 Opslaan als HTML-bestand</button>
</div>

<h1>SpuitLogger — Juridisch dossier</h1>
<table class="meta-table">
  <tr><td>Locatie</td><td>${escapeHTML(locatieLabel || 'Onbekend')}</td></tr>
  ${gemeente ? `<tr><td>Gemeente</td><td>${escapeHTML(gemeente)}</td></tr>` : ''}
  <tr><td>Aantal meldingen</td><td>${meldingen.length}</td></tr>
  <tr><td>Periode</td><td>${datums.length ? `${datums[0].toLocaleDateString('nl-NL')} — ${datums[datums.length - 1].toLocaleDateString('nl-NL')}` : '—'}</td></tr>
  <tr><td>Gegenereerd op</td><td>${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}</td></tr>
  <tr><td>SpuitLogger versie</td><td>${escapeHTML(APP_VERSION_CLIENT)}</td></tr>
</table>

${tocHTML}

${secties.join('\n')}

<script>${LIGHTBOX_JS}<\/script>
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
  // Niet revoceeren — de pagina heeft de blob nodig voor de "Opslaan als HTML" functie.
  // Moderne browsers ruimen de blob URL op zodra de tab gesloten wordt.
}
