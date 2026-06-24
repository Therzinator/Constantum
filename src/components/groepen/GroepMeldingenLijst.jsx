import { useEffect, useState } from 'react';
import { haalMeldingenVoorGroep } from '../../lib/groepen/groepen.js';
import { bepaalZichtbaarheidsniveau, velden } from '../../lib/groepen/trustZichtbaarheid.js';
import { melderCode } from '../../utils/format.js';
import { GroepMeldingDetailModal } from './GroepMeldingDetailModal.jsx';
import '../meldingen/MeldingCard.css';
import './GroepMeldingenLijst.css';

const TYPE_LABEL = {
  spuitactiviteit: '🚜 Spuitactiviteit',
  drift: '💨 Drift/nevel',
  geur: '🌬️ Chemische geur',
  geluid: '🔊 Geluid',
  gezondheid: '🏥 Gezondheid',
  overig: '📝 Overig'
};

// Zelfde badge-kleuren per type als MeldingCard.jsx (bewust gedupliceerd,
// zelfde patroon als TYPE_KLEUR tussen MeldingCard.jsx/BuurtgebiedTekenaar.jsx
// — geen gedeelde module, zie CURRENT_STATE.md).
const TYPE_BADGE = {
  spuitactiviteit: 'badge-warning',
  drift: 'badge-info',
  geur: 'badge-muted',
  gezondheid: 'badge-danger',
  geluid: 'badge-muted',
  overig: 'badge-muted'
};

const NIVEAU_LABEL = { laag: 'Laag', gemiddeld: 'Gemiddeld', hoog: 'Hoog' };

// Sectie 1/5 — meldingen binnen een groep, in dezelfde kaart-vorm als
// "Recente meldingen" (Dashboard, MeldingCard.jsx compacte variant) i.p.v.
// een platte tekstlijst. Hoeveel detail elke kaart toont hangt af van de
// trust score van de KIJKER (niet de melder) — de toegangs-gate (is de
// melding wel met deze groep gedeeld) is al RLS-niveau (migratie 0015);
// hier wordt alleen bepaald welke VELDEN getoond worden, via
// src/lib/groepen/trustZichtbaarheid.js (config-gebaseerd, zodat nieuwe
// niveaus later makkelijk toevoegbaar zijn).
export function GroepMeldingenLijst({ groepId, viewerTrustScore, viewerUserId, user }) {
  const [meldingen, setMeldingen] = useState(null);
  const [fout, setFout] = useState(null);
  const [geopend, setGeopend] = useState(null);

  useEffect(() => {
    let actief = true;
    haalMeldingenVoorGroep(groepId)
      .then((data) => { if (actief) setMeldingen(data); })
      .catch((err) => { if (actief) setFout(err.message); });
    return () => { actief = false; };
  }, [groepId]);

  const niveau = bepaalZichtbaarheidsniveau(viewerTrustScore);
  const toon = velden(niveau);

  if (fout) return <div className="export-card-beschrijving" style={{ color: 'var(--danger)' }}>Meldingen laden mislukt: {fout}</div>;
  if (!meldingen) return <div className="export-card-beschrijving">Meldingen laden...</div>;
  if (meldingen.length === 0) return <div className="export-card-beschrijving">Nog geen meldingen gedeeld met deze groep.</div>;

  return (
    <div>
      <div className="export-card-beschrijving mb-2">
        Jouw zichtbaarheidsniveau in deze groep: <strong>{NIVEAU_LABEL[niveau] || niveau}</strong>, gebaseerd op je eigen trust score.
      </div>
      {meldingen.map((m) => {
        const datum = new Date(m.timestamp_local).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
        const isEigen = m.user_id && m.user_id === viewerUserId;
        const regio = toon.grofweLocatie ? [m.gemeente, m.provincie].filter(Boolean).join(', ') : null;

        return (
          <div
            key={m.id}
            className="card melding-card melding-card-klikbaar"
            role="button"
            tabIndex={0}
            onClick={() => setGeopend(m)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setGeopend(m); }}
          >
            <div className="melding-card-body">
              <div className="melding-card-top">
                <div className="melding-card-badges">
                  <span className={`badge ${TYPE_BADGE[m.type] || 'badge-muted'}`}>{TYPE_LABEL[m.type] || m.type}</span>
                </div>
                <span className="melding-card-date">{datum}</span>
              </div>

              {regio && (
                <div className="melding-card-compact-rij2">
                  <span className="melding-card-desc">{regio}</span>
                </div>
              )}

              {toon.metadata && m.description && (
                <div className="melding-card-desc mt-1">{m.description}</div>
              )}

              {toon.exacteLocatie && m.gps_lat != null && m.gps_lng != null && (
                <div className="hash-display mt-1">{m.gps_lat.toFixed(5)}, {m.gps_lng.toFixed(5)}</div>
              )}

              {toon.melderInfo && !isEigen && m.melder_email && (
                <div className="melding-card-meta mt-1">
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>{melderCode(m.melder_email)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {geopend && (
        <GroepMeldingDetailModal
          melding={geopend}
          toon={toon}
          isEigen={geopend.user_id && geopend.user_id === viewerUserId}
          user={user}
          onClose={() => setGeopend(null)}
        />
      )}
    </div>
  );
}
