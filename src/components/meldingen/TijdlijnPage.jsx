import { useMemo, useState } from 'react';
import { MeldingCard } from './MeldingCard.jsx';
import { ClusterCard } from './ClusterCard.jsx';
import { clusterMeldingen } from '../../lib/meldingen/clustering.js';
import { MeldingDetailModal } from '../melding/MeldingDetailModal.jsx';
import './TijdlijnPage.css';

const TYPE_OPTIES = [
  ['', 'Alle typen'],
  ['spuitactiviteit', 'Spuitactiviteit'],
  ['drift', 'Drift/nevel'],
  ['geur', 'Chemische geur'],
  ['geluid', 'Geluid'],
  ['gezondheid', 'Gezondheid'],
  ['overig', 'Overig']
];

const MAAND_OPTIES = [
  ['', 'Alle maanden'], ['01', 'Januari'], ['02', 'Februari'], ['03', 'Maart'], ['04', 'April'],
  ['05', 'Mei'], ['06', 'Juni'], ['07', 'Juli'], ['08', 'Augustus'], ['09', 'September'],
  ['10', 'Oktober'], ['11', 'November'], ['12', 'December']
];

// Komt overeen met de pagina 'tijdlijn' uit docs/index.html: zoeken/filteren
// (renderTimeline) + omschakelen tussen platte lijst en spuitgebeurtenis-
// clustering (setTijdlijnModus/clusterMeldingen). Beheert de detail-modal
// zelf zodat zowel losse meldingen als clusters 'm kunnen openen.
export function TijdlijnPage({ meldingenApi, user, gebruikerRol }) {
  const { meldingen, verwijderMeldingLokaal } = meldingenApi;
  const [zoek, setZoek] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMaand, setFilterMaand] = useState('');
  const [filterJaar, setFilterJaar] = useState('');
  const [modus, setModus] = useState('los');
  const [geselecteerdId, setGeselecteerdId] = useState(null);

  const jaren = useMemo(
    () => [...new Set(meldingen.map((m) => new Date(m.timestamp_local).getFullYear()))].sort((a, b) => b - a),
    [meldingen]
  );

  const gefiltered = useMemo(() => {
    const zoekLower = zoek.trim().toLowerCase();
    return meldingen
      .filter((m) => {
        if (filterType) {
          const matchType = m.type === filterType;
          const matchTypes = Array.isArray(m.types) && m.types.includes(filterType);
          if (!matchType && !matchTypes) return false;
        }
        const d = new Date(m.timestamp_local);
        if (filterJaar && String(d.getFullYear()) !== filterJaar) return false;
        if (filterMaand && String(d.getMonth() + 1).padStart(2, '0') !== filterMaand) return false;
        if (zoekLower) {
          const typesStr = Array.isArray(m.types) ? m.types.join(' ') : '';
          const tekst = `${m.description} ${m.type} ${typesStr} ${m.id} ${m.melder_email || ''}`.toLowerCase();
          if (!tekst.includes(zoekLower)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp_local) - new Date(a.timestamp_local));
  }, [meldingen, zoek, filterType, filterMaand, filterJaar]);

  const clusters = useMemo(
    () => (modus === 'cluster' ? clusterMeldingen(gefiltered) : null),
    [modus, gefiltered]
  );

  const handleVerwijderen = (id) => {
    if (!confirm('Registratie verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
    verwijderMeldingLokaal(id);
  };

  const geselecteerd = geselecteerdId ? meldingen.find((m) => m.id === geselecteerdId) : null;

  return (
    <div className="p-4">
      <div className="tijdlijn-header">
        <div>
          <div className="tijdlijn-titel">Dossier Tijdlijn</div>
          <div className="tijdlijn-count">{gefiltered.length} meldingen</div>
        </div>
        <div className="tijdlijn-modus">
          <button type="button" className={`tijdlijn-modus-btn ${modus === 'los' ? 'actief' : ''}`} onClick={() => setModus('los')}>
            📋 Alle meldingen
          </button>
          <button type="button" className={`tijdlijn-modus-btn ${modus === 'cluster' ? 'actief' : ''}`} onClick={() => setModus('cluster')}>
            🔗 Gebeurtenissen
          </button>
        </div>
      </div>

      <div className="card tijdlijn-filters">
        <label className="section-label">Filters &amp; zoeken</label>
        <input
          type="text"
          className="form-input px-3 py-2"
          placeholder="Zoeken in meldingen..."
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <div className="tijdlijn-filters-grid">
          <select className="tijdlijn-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            {TYPE_OPTIES.map(([waarde, label]) => <option key={waarde} value={waarde}>{label}</option>)}
          </select>
          <select className="tijdlijn-select" value={filterMaand} onChange={(e) => setFilterMaand(e.target.value)}>
            {MAAND_OPTIES.map(([waarde, label]) => <option key={waarde} value={waarde}>{label}</option>)}
          </select>
        </div>
        <select className="tijdlijn-select" value={filterJaar} onChange={(e) => setFilterJaar(e.target.value)}>
          <option value="">Alle jaren</option>
          {jaren.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      {gefiltered.length === 0 ? (
        <div className="tijdlijn-leeg">Geen meldingen gevonden.</div>
      ) : modus === 'cluster' ? (
        clusters.map((cluster) => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            user={user}
            gebruikerRol={gebruikerRol}
            onVerwijderen={handleVerwijderen}
            onSelecteren={setGeselecteerdId}
          />
        ))
      ) : (
        gefiltered.map((m) => (
          <MeldingCard
            key={m.id}
            melding={m}
            user={user}
            gebruikerRol={gebruikerRol}
            onVerwijderen={handleVerwijderen}
            onSelecteren={setGeselecteerdId}
          />
        ))
      )}

      {geselecteerd && (
        <MeldingDetailModal melding={geselecteerd} alleMeldingen={meldingen} onClose={() => setGeselecteerdId(null)} />
      )}
    </div>
  );
}
