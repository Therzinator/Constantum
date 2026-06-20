import { useEffect, useRef, useState } from 'react';
import { meldingenNaarCSV } from '../../lib/export/csv.js';
import { meldingenNaarJSONBackup } from '../../lib/export/json.js';
import { downloadFile } from '../../lib/export/download.js';
import { getStorageSize } from '../../lib/storage/localStorage.js';
import { idbCountBijlagen, idbVerwijderVerweesdeBijlagen } from '../../lib/storage/indexedDB.js';
import { Toast } from '../ui/Toast.jsx';
import './ExportPage.css';

// Komt overeen met de pagina 'export' (CSV/JSON/dossier-info, bron regel
// 1299-1419) plus de opslag-opschonen/gevaarzone-kaarten die in de bron op
// de Instellingen-pagina staan (regel 1569-1602) — die pagina bestaat in
// deze app nog niet (Fase G), dus opslagbeheer staat hier alvast bij de
// rest van "data-beheer". PDF-export is een latere, eigen stap.
export function ExportPage({ meldingenApi, thuislocatie }) {
  const { meldingen, importeerMeldingen, verwijderAlleMeldingenLokaal } = meldingenApi;
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

  const handleOpslagOpschonen = async () => {
    const geldigeIds = new Set(meldingen.map((m) => m.id));
    const aantal = await idbVerwijderVerweesdeBijlagen(geldigeIds);
    if (aantal === 0) toon('Geen verouderde bijlagen gevonden', 'success');
    else toon(`✓ ${aantal} verouderde bijlagen verwijderd`, 'success');
    idbCountBijlagen().then(setIdbCount);
  };

  const handleAllesVerwijderen = async () => {
    if (!confirm('⚠️ WAARSCHUWING: Alle meldingen worden permanent verwijderd. Maak eerst een backup!\n\nDoorgaan?')) return;
    if (!confirm('Weet u het zeker? Dit kan NIET ongedaan worden gemaakt.')) return;
    await verwijderAlleMeldingenLokaal();
    toon('Alle data verwijderd (localStorage + IndexedDB)', 'error');
  };

  const dates = meldingen.map((m) => new Date(m.timestamp_local)).sort((a, b) => a - b);
  const totaalBijlagen = meldingen.reduce((s, m) => s + (m.bestanden?.length || 0), 0);

  return (
    <div className="p-4 export-page">
      <div>
        <div className="export-titel">Export &amp; Backup</div>
        <div className="export-subtitel">Juridisch dossier exporteren</div>
      </div>

      <div className="card p-4 export-card">
        <div className="export-card-icoon">💾</div>
        <div className="flex-1">
          <div className="export-card-titel">JSON Backup</div>
          <div className="export-card-beschrijving">Volledige ruwe data backup incl. weerdata JSON</div>
          <button type="button" className="btn-outline px-4 py-2 mt-3" onClick={handleExportJSON}>
            💾 Exporteer JSON
          </button>
        </div>
      </div>

      <div className="card p-4 export-card">
        <div className="export-card-icoon">📊</div>
        <div className="flex-1">
          <div className="export-card-titel">CSV Export</div>
          <div className="export-card-beschrijving">Platte tabel van alle meldingen, te openen in Excel/Sheets</div>
          <button type="button" className="btn-outline px-4 py-2 mt-3" onClick={handleExportCSV}>
            📊 Exporteer CSV
          </button>
        </div>
      </div>

      <div className="card p-4 export-card">
        <div className="export-card-icoon">📥</div>
        <div className="flex-1">
          <div className="export-card-titel">JSON Importeren</div>
          <div className="export-card-beschrijving">Herstel eerder gemaakte backup</div>
          <input ref={importInputRef} type="file" accept=".json" className="export-hidden-input" onChange={handleImportJSON} />
          <button type="button" className="btn-outline px-4 py-2 mt-3" onClick={() => importInputRef.current?.click()}>
            📂 Importeer JSON
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">Dossier Informatie</div>
        <div className="export-info-rij"><span>Totaal meldingen:</span><span className="export-info-waarde-accent">{meldingen.length}</span></div>
        <div className="export-info-rij"><span>Eerste melding:</span><span>{dates.length ? dates[0].toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : '—'}</span></div>
        <div className="export-info-rij"><span>Laatste melding:</span><span>{dates.length ? dates[dates.length - 1].toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : '—'}</span></div>
        <div className="export-info-rij"><span>Opslag (LS):</span><span>{getStorageSize()}</span></div>
        <div className="export-info-rij"><span>Bijlagen (totaal):</span><span className="export-info-waarde-info">{totaalBijlagen}</span></div>
        <div className="export-info-rij"><span>Bijlagen in IndexedDB:</span><span className="export-info-waarde-accent">{idbCount ?? '—'}</span></div>
      </div>

      <div className="card p-4 export-opschonen">
        <div className="section-label mb-2" style={{ color: 'var(--info)' }}>🧹 Opslag Opschonen</div>
        <div className="export-card-beschrijving mb-3">
          Verwijdert tijdelijke cache en oude previews uit IndexedDB. <strong>Meldingen blijven behouden.</strong>
        </div>
        <button type="button" className="btn-outline px-4 py-2" style={{ borderColor: 'var(--info)', color: 'var(--info)' }} onClick={handleOpslagOpschonen}>
          🧹 Verwijder bijlagen zonder melding
        </button>
      </div>

      <div className="card p-4 export-gevaarzone">
        <div className="section-label mb-2" style={{ color: 'var(--danger)' }}>⚠️ Gevaarzone</div>
        <div className="export-card-beschrijving mb-3">Verwijder alle lokaal opgeslagen meldingen. Dit kan niet ongedaan worden gemaakt.</div>
        <button type="button" className="btn-outline px-4 py-2" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleAllesVerwijderen}>
          🗑️ Alle data verwijderen
        </button>
      </div>

      <Toast melding={melding} />
    </div>
  );
}
