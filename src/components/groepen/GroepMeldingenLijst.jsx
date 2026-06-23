import { useEffect, useState } from 'react';
import { haalMeldingenVoorGroep } from '../../lib/groepen/groepen.js';
import { bepaalZichtbaarheidsniveau, velden } from '../../lib/groepen/trustZichtbaarheid.js';
import { melderCode } from '../../utils/format.js';

const TYPE_LABEL = {
  spuitactiviteit: '🚜 Spuitactiviteit',
  drift: '💨 Drift/nevel',
  geur: '🌬️ Chemische geur',
  geluid: '🔊 Geluid',
  gezondheid: '🏥 Gezondheid',
  overig: '📝 Overig'
};

// Sectie 1/5 — meldingen binnen een groep, uitgebreider zichtbaar
// afhankelijk van de trust score van de KIJKER (niet de melder). De
// toegangs-gate (is de melding wel met deze groep gedeeld) is al
// RLS-niveau (migratie 0015); hier wordt alleen bepaald welke VELDEN
// getoond worden, via src/lib/groepen/trustZichtbaarheid.js (config-
// gebaseerd, niet hardcoded if/else, zodat nieuwe niveaus later makkelijk
// toevoegbaar zijn).
export function GroepMeldingenLijst({ groepId, viewerTrustScore, viewerUserId }) {
  const [meldingen, setMeldingen] = useState(null);
  const [fout, setFout] = useState(null);

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
        Jouw zichtbaarheidsniveau in deze groep: <strong>{niveau}</strong> (gebaseerd op je eigen trust score).
      </div>
      {meldingen.map((m) => {
        const datum = new Date(m.timestamp_local).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
        const isEigen = m.user_id && m.user_id === viewerUserId;
        return (
          <div key={m.id} className="export-info-rij" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span>{TYPE_LABEL[m.type] || m.type} · {datum}</span>
            {toon.grofweLocatie && (m.gemeente || m.provincie) && (
              <span>{[m.gemeente, m.provincie].filter(Boolean).join(', ')}</span>
            )}
            {toon.exacteLocatie && m.gps_lat != null && m.gps_lng != null && (
              <span>{m.gps_lat.toFixed(5)}, {m.gps_lng.toFixed(5)}</span>
            )}
            {toon.metadata && <span>{m.description}</span>}
            {toon.melderInfo && !isEigen && m.melder_email && <span>{melderCode(m.melder_email)}</span>}
          </div>
        );
      })}
    </div>
  );
}
