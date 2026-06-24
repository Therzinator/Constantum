import { useEffect, useRef, useState } from 'react';
import { meldingenNaarCSV } from '../../lib/export/csv.js';
import { meldingenNaarJSONBackup } from '../../lib/export/json.js';
import { genereerDossierHTML, openDossierPDF } from '../../lib/export/pdf.js';
import { downloadFile } from '../../lib/export/download.js';
import { getStorageSize } from '../../lib/storage/localStorage.js';
import { idbCountBijlagen } from '../../lib/storage/indexedDB.js';
import { Toast } from '../ui/Toast.jsx';
import './ExportPage.css';

// Komt overeen met de pagina 'export' uit docs/index.html (CSV/JSON/
// dossier-info, bron regel 1299-1419). Opslagbeheer, gevaarzone en
// account-/notificatie-instellingen staan sinds Fase G op hun eigen
// Instellingen-pagina (zie InstellingenPage.jsx).
export function ExportPage({ meldingenApi, thuislocatie }) {
  const { meldingen, importeerMeldingen } = meldingenApi;
  const [idbCount, setIdbCount] = useState(null);
  const [melding, setMelding] = useState(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    idbCountBijlagen().then(setIdbCount);
  }, [meldingen]);

  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  const handleExportCSV = () => {
    if (!meldingen.length) { toon('Geen meldingen om te exporteren', 'error'); return; }
    const csv = meldingenNaarCSV(meldingen);
    downloadFile(csv, `spuitlog_export_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    toon('✓ CSV gedownload', 'success');
  };

  const handleExportPDF = async () => {
    if (!meldingen.length) { toon('Geen meldingen om te exporteren', 'error'); return; }
    toon('PDF-dossier voorbereiden...', 'success');
    try {
      const html = await genereerDossierHTML(meldingen, thuislocatie?.label);
      openDossierPDF(html);
      toon('✓ Dossier geopend, gebruik "Afdrukken als PDF"', 'success');
    } catch (err) {
      toon(err.message, 'error');
    }
  };

  const handleExportJSON = async () => {
    if (!meldingen.length) { toon('Geen meldingen om te exporteren', 'error'); return; }
    toon('JSON backup voorbereiden...', 'success');
    const backup = await meldingenNaarJSONBackup(meldingen, thuislocatie?.label);
    downloadFile(JSON.stringify(backup, null, 2), `spuitlog_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    toon("✓ JSON backup gedownload (incl. foto's)", 'success');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const nieuweMeldingen = data.meldingen || data;
        if (!Array.isArray(nieuweMeldingen)) { toon('Ongeldig backup formaat', 'error'); return; }
        if (!confirm(`${nieuweMeldingen.length} meldingen importeren? Bestaande data blijft behouden.`)) return;
        const aantalNieuw = importeerMeldingen(nieuweMeldingen);
        toon(`✓ ${aantalNieuw} nieuwe meldingen geïmporteerd`, 'success');
      } catch (err) {
        toon('Fout bij importeren: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  const dates = meldingen.map((m) => new Date(m.timestamp_local)).sort((a, b) => a - b);
  const totaalBijlagen = meldingen.reduce((s, m) => s + (m.bestanden?.length || 0), 0);

  return (
    <div className="export-page">
      <div>
        <div className="export-titel">Export &amp; Backup</div>
        <div className="export-subtitel">Juridisch dossier exporteren</div>
      </div>

      <div className="card p-4 export-card">
        <div className="export-card-icoon">📄</div>
        <div className="export-card-inhoud">
          <div className="export-card-titel">PDF Dossier</div>
          <div className="export-card-beschrijving">Juridisch dossier met hash, RFC 3161, weerdata en foto's, printbaar/opslaan als PDF</div>
          <button type="button" className="btn-outline export-knop mt-3" onClick={handleExportPDF}>
            📄 Open PDF-dossier
          </button>
        </div>
      </div>

      <div className="card p-4 export-card">
        <div className="export-card-icoon">💾</div>
        <div className="export-card-inhoud">
          <div className="export-card-titel">JSON Backup</div>
          <div className="export-card-beschrijving">Volledige ruwe data backup incl. weerdata JSON</div>
          <button type="button" className="btn-outline export-knop mt-3" onClick={handleExportJSON}>
            💾 Exporteer JSON
          </button>
        </div>
      </div>

      <div className="card p-4 export-card">
        <div className="export-card-icoon">📊</div>
        <div className="export-card-inhoud">
          <div className="export-card-titel">CSV Export</div>
          <div className="export-card-beschrijving">Platte tabel van alle meldingen, te openen in Excel/Sheets</div>
          <button type="button" className="btn-outline export-knop mt-3" onClick={handleExportCSV}>
            📊 Exporteer CSV
          </button>
        </div>
      </div>

      <div className="card p-4 export-card">
        <div className="export-card-icoon">📥</div>
        <div className="export-card-inhoud">
          <div className="export-card-titel">JSON Importeren</div>
          <div className="export-card-beschrijving">Herstel eerder gemaakte backup</div>
          <input ref={importInputRef} type="file" accept=".json" className="export-hidden-input" onChange={handleImportJSON} />
          <button type="button" className="btn-outline export-knop mt-3" onClick={() => importInputRef.current?.click()}>
            📂 Importeer JSON
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">Dossier Informatie</div>
        <div className="export-stat-grid">
          <div className="export-stat-tegel">
            <div className="export-stat-tegel-waarde export-info-waarde-accent">{meldingen.length}</div>
            <div className="export-stat-tegel-label">Totaal meldingen</div>
          </div>
          <div className="export-stat-tegel">
            <div className="export-stat-tegel-waarde export-info-waarde-accent">{idbCount ?? '—'}</div>
            <div className="export-stat-tegel-label">Bijlagen in IndexedDB</div>
          </div>
          <div className="export-stat-tegel">
            <div className="export-stat-tegel-waarde export-info-waarde-info">{totaalBijlagen}</div>
            <div className="export-stat-tegel-label">Bijlagen totaal</div>
          </div>
          <div className="export-stat-tegel">
            <div className="export-stat-tegel-waarde">{getStorageSize()}</div>
            <div className="export-stat-tegel-label">Opslag (LS)</div>
          </div>
        </div>
        <div className="export-info-rij mt-2"><span>Eerste melding</span><span>{dates.length ? dates[0].toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : '—'}</span></div>
        <div className="export-info-rij"><span>Laatste melding</span><span>{dates.length ? dates[dates.length - 1].toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : '—'}</span></div>
      </div>

      <Toast melding={melding} />
    </div>
  );
}
