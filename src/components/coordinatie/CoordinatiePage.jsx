import { useEffect, useState } from 'react';
import { melderCode } from '../../utils/format.js';
import {
  haalAlleEntriesAdmin,
  haalAlleProfielenAdmin,
  zetTrustScoreAdmin,
  zetVisibilityAdmin
} from '../../lib/supabase/admin.js';
import { perceelStatistieken } from '../../lib/meldingen/statistieken.js';
import { BuurtrapportGenerator } from './BuurtrapportGenerator.jsx';
import {
  meldersPerPostcode,
  trustScoreVerdeling,
  meldersOverzicht,
  meldingenOnderReview
} from '../../lib/meldingen/coordinatieStatistieken.js';
import './CoordinatiePage.css';

// Coordinatie & Admin systeem, Fase 4 — admin-panel. Alleen bereikbaar via
// de "Coördinatie"-tab die enkel zichtbaar is voor role='admin' (zie
// BottomNav.jsx/App.jsx) — de echte afscherming gebeurt via de admin-RLS-
// bypass uit migratie 0004, niet hier.
export function CoordinatiePage({ user }) {
  const [entries, setEntries] = useState(null);
  const [profielen, setProfielen] = useState(null);
  const [fout, setFout] = useState(null);
  const [bezigId, setBezigId] = useState(null);

  const laad = async () => {
    try {
      const [e, p] = await Promise.all([haalAlleEntriesAdmin(), haalAlleProfielenAdmin()]);
      setEntries(e);
      setProfielen(p);
    } catch (err) {
      setFout(err.message);
    }
  };

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const [e, p] = await Promise.all([haalAlleEntriesAdmin(), haalAlleProfielenAdmin()]);
        if (actief) { setEntries(e); setProfielen(p); }
      } catch (err) {
        if (actief) setFout(err.message);
      }
    })();
    return () => { actief = false; };
  }, []);

  if (fout) return <div className="p-4"><div className="card p-4" style={{ color: 'var(--danger)' }}>Laden mislukt: {fout}</div></div>;
  if (!entries || !profielen) return <div className="p-4">Laden...</div>;

  const perPostcode = meldersPerPostcode(entries);
  const verdeling = trustScoreVerdeling(profielen);
  const perceelStats = perceelStatistieken(entries);
  const melders = meldersOverzicht(entries, profielen);
  const onderReview = meldingenOnderReview(entries);

  const handleTrustScore = async (userId, waarde) => {
    setBezigId(userId);
    try {
      await zetTrustScoreAdmin(userId, waarde);
      await laad();
    } finally {
      setBezigId(null);
    }
  };

  const handleGoedkeuren = async (entryId) => {
    setBezigId(entryId);
    try {
      await zetVisibilityAdmin(entryId, 'normal');
      await laad();
    } finally {
      setBezigId(null);
    }
  };

  return (
    <div className="p-4 coordinatie-page">
      <div className="export-titel">Coördinatie</div>
      <div className="export-subtitel">Admin-overzicht — niet zichtbaar voor gewone gebruikers</div>

      <div className="card p-4">
        <div className="section-label mb-3">📮 Opt-in-melders per postcode</div>
        {perPostcode.length === 0 && <div className="export-card-beschrijving">Geen opt-in-meldingen met postcode gevonden.</div>}
        {perPostcode.map((r) => (
          <div key={r.postcode} className="export-info-rij">
            <span>{r.postcode}</span>
            <span>{r.aantalMelders} melder{r.aantalMelders === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">🛡️ Trust-score-verdeling</div>
        {verdeling.map((b) => (
          <div key={b.label} className="export-info-rij">
            <span>{b.label}</span>
            <span>{b.aantal} gebruiker{b.aantal === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">🌾 Perceel-analyse</div>
        {Object.keys(perceelStats).length === 0 && <div className="export-card-beschrijving">Geen percelen gevonden.</div>}
        {Object.entries(perceelStats).map(([perceel, stats]) => (
          <div key={perceel} className="export-info-rij">
            <span>{perceel}</span>
            <span>{stats.totaal}x · {stats.ditJaar}x dit jaar{stats.bovenWindNorm ? ` · ${stats.bovenWindNorm}x boven windnorm` : ''}</span>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">👥 Melder-overzicht</div>
        {melders.map((m) => (
          <div key={m.userId} className="coordinatie-melder-rij">
            <div className="export-info-rij">
              <span>{melderCode(m.melderEmail) || m.userId.slice(0, 8)}</span>
              <span>{m.aantalMeldingen} melding{m.aantalMeldingen === 1 ? '' : 'en'}{m.aantalUnderReview ? ` · ${m.aantalUnderReview} under review` : ''}{m.aantalShadow ? ` · ${m.aantalShadow} shadow` : ''}</span>
            </div>
            <div className="export-info-rij">
              <span>Trust score</span>
              <input
                type="number"
                min="0"
                max="100"
                defaultValue={m.trustScore ?? 75}
                disabled={bezigId === m.userId}
                className="coordinatie-trust-input"
                onBlur={(e) => {
                  const waarde = parseInt(e.target.value, 10);
                  if (!Number.isNaN(waarde) && waarde !== m.trustScore) handleTrustScore(m.userId, waarde);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <BuurtrapportGenerator user={user} />

      <div className="card p-4">
        <div className="section-label mb-3" style={{ color: 'var(--danger)' }}>🚩 Onder review / shadow</div>
        {onderReview.length === 0 && <div className="export-card-beschrijving">Geen meldingen onder review of shadow.</div>}
        {onderReview.map((e) => (
          <div key={e.id} className="export-info-rij">
            <span>{melderCode(e.melder_email) || '—'} · {e.type} · {e.visibility} · {new Date(e.timestamp_local).toLocaleDateString('nl-NL')}</span>
            <button
              type="button"
              className="btn-outline px-2 py-1"
              disabled={bezigId === e.id}
              onClick={() => handleGoedkeuren(e.id)}
            >
              ✓ Goedkeuren
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
