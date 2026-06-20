import { APP_VERSION_CLIENT } from '../version.js';

// Coordinatie & Admin systeem, Fase 7 — collectief, geanonimiseerd
// buurtrapport. In tegenstelling tot genereerDossierHTML (pdf.js, één
// melder, met Melder#XXXXXX-code per melding) toont dit rapport bewust
// GEEN individuele melder-codes — alleen aggregaten — omdat het bedoeld is
// om buiten de kring van melders te delen (bv. met een advocaat of
// gemeente).
function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function genereerBuurtrapportHTML(rapport) {
  const { postcodegebied, periodeVan, periodeTot, aantalMelders, aantalMeldingen, seizoenspatroon, windroosPerPerceel, bewijswaardescore, rfc3161Percentage, knmiPercentage } = rapport;

  const seizoenRijen = seizoenspatroon
    .map((m) => `<tr><td>${escapeHTML(m.label)}</td><td>${m.aantal}</td></tr>`)
    .join('');

  const windroosSecties = Object.entries(windroosPerPerceel).map(([perceel, richtingen]) => `
    <h4>Perceel ${escapeHTML(perceel)}</h4>
    <table class="meta-table">
      ${Object.entries(richtingen).map(([r, n]) => `<tr><td>${escapeHTML(r)}</td><td>${n}</td></tr>`).join('')}
    </table>`).join('') || '<p>Geen windrichtingsdata beschikbaar.</p>';

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Buurtrapport ${escapeHTML(postcodegebied)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; max-width: 800px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 20px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h3 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid #999; padding-bottom: 4px; }
  h4 { font-size: 12px; margin: 12px 0 4px; color: #444; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .meta-table td { padding: 2px 6px; border-bottom: 1px solid #eee; font-size: 12px; }
  .meta-table td:first-child { color: #666; width: 220px; }
  .score { font-size: 32px; font-weight: bold; }
  .print-knop { margin: 16px 0; padding: 8px 16px; cursor: pointer; }
  @media print { .print-knop { display: none; } }
</style>
</head>
<body>
  <button class="print-knop" onclick="window.print()">🖨️ Afdrukken als PDF</button>
  <h1>SpuitLogger — Collectief buurtrapport</h1>
  <p><em>Geanonimiseerd — toont alleen geaggregeerde cijfers, geen individuele melder-identificatie.</em></p>

  <table class="meta-table">
    <tr><td>Postcodegebied</td><td>${escapeHTML(postcodegebied)}</td></tr>
    <tr><td>Periode</td><td>${escapeHTML(periodeVan || '—')} t/m ${escapeHTML(periodeTot || '—')}</td></tr>
    <tr><td>Aantal opt-in-melders</td><td>${aantalMelders}</td></tr>
    <tr><td>Aantal meldingen</td><td>${aantalMeldingen}</td></tr>
    <tr><td>Meldingen met RFC 3161-tijdstempel</td><td>${rfc3161Percentage}%</td></tr>
    <tr><td>KNMI-dekking (live check)</td><td>${knmiPercentage != null ? `${knmiPercentage}%` : 'niet gecontroleerd'}</td></tr>
    <tr><td>Gegenereerd op</td><td>${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}</td></tr>
    <tr><td>SpuitLogger versie</td><td>${escapeHTML(APP_VERSION_CLIENT)}</td></tr>
  </table>

  <h3>Bewijswaardescore</h3>
  <p class="score">${bewijswaardescore} / 100</p>
  <p><em>Heuristische indicatie (melders × RFC3161-dekking × KNMI-dekking × gemiddelde trust score), geen juridisch keurmerk.</em></p>

  <h3>Seizoenspatroon</h3>
  <table class="meta-table">${seizoenRijen}</table>

  <h3>Windroos per perceel</h3>
  ${windroosSecties}
</body>
</html>`;
}

export function openBuurtrapportPDF(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Pop-up geblokkeerd — sta pop-ups toe voor deze site en probeer opnieuw');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
