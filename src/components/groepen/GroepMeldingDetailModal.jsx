import { lazy, Suspense, useEffect, useState } from 'react';
import { laadBijlagenVanSupabase } from '../../lib/supabase/bijlagen.js';
import { melderCode } from '../../utils/format.js';
import { Lightbox } from '../melding/Lightbox.jsx';
import './GroepMeldingDetailModal.css';

const DriftZoneKaart = lazy(() => import('../melding/DriftZoneKaart.jsx').then((m) => ({ default: m.DriftZoneKaart })));

const TYPE_LABEL = {
  spuitactiviteit: '🚜 Spuitactiviteit',
  drift: '💨 Drift/nevel',
  geur: '🌬️ Chemische geur',
  geluid: '🔊 Geluid',
  gezondheid: '🏥 Gezondheid',
  overig: '📝 Overig'
};

const TYPE_BADGE = {
  spuitactiviteit: 'badge-warning',
  drift: 'badge-info',
  geur: 'badge-muted',
  gezondheid: 'badge-danger',
  geluid: 'badge-muted',
  overig: 'badge-muted'
};

// Detailweergave van één gedeelde groepsmelding — lichter dan
// MeldingDetailModal.jsx (geen hash/RFC3161/device/weerdata: die velden
// zitten niet in haalMeldingenVoorGroep() en horen bij het zwaardere
// bewijsdossier, niet bij de sociale Groepen-functie, zie DECISIONS.md).
// Toont alleen de velden die `toon` (trustZichtbaarheid.js) toestaat voor
// de KIJKER — dezelfde gate als de kaart in GroepMeldingenLijst.jsx,
// alleen hier met de volledige omschrijving/locatie/foto's i.p.v. een
// compacte preview.
export function GroepMeldingDetailModal({ melding, toon, isEigen, user, onClose }) {
  const [bestanden, setBestanden] = useState(null);
  const [bestandenFout, setBestandenFout] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    if (!toon.fotos) return;
    let actief = true;
    laadBijlagenVanSupabase(melding.id, user)
      .then((data) => { if (actief) setBestanden(data); })
      .catch((err) => { if (actief) setBestandenFout(err.message); });
    return () => { actief = false; };
  }, [melding.id, toon.fotos, user]);

  const datum = new Date(melding.timestamp_local).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  const regio = toon.grofweLocatie ? [melding.gemeente, melding.provincie].filter(Boolean).join(', ') : null;
  // DriftZoneKaart verwacht melding.gps.lat/lng, groep-meldingen hebben gps_lat/gps_lng
  const meldingVoorKaart = melding.gps_lat != null ? { ...melding, gps: { lat: melding.gps_lat, lng: melding.gps_lng } } : null;

  return (
    <div className="detail-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="detail-modal">
        <button type="button" className="detail-modal-close" onClick={onClose} aria-label="Sluiten">✕</button>

        <div className="detail-modal-badges">
          <span className={`badge ${TYPE_BADGE[melding.type] || 'badge-muted'}`}>{TYPE_LABEL[melding.type] || melding.type}</span>
          {melding.visibility && melding.visibility !== 'normal' && <span className="badge badge-warning">{melding.visibility}</span>}
          {toon.melderInfo && !isEigen && melding.melder_email && <span className="badge badge-muted">{melderCode(melding.melder_email)}</span>}
        </div>

        <div className="card p-3">
          <div className="section-label mb-2">Wanneer &amp; waar</div>
          <div className="detail-mono-block">{datum}</div>
          {regio && <div className="detail-mono-block mt-1">{regio}</div>}
          {toon.exacteLocatie && meldingVoorKaart && (
            <>
              <Suspense fallback={<div className="export-card-beschrijving mt-2">Kaart laden...</div>}>
                <DriftZoneKaart melding={meldingVoorKaart} hoogte={200} />
              </Suspense>
              <div className="hash-display mt-1">{melding.gps_lat.toFixed(5)}, {melding.gps_lng.toFixed(5)}</div>
            </>
          )}
          {!toon.grofweLocatie && !toon.exacteLocatie && (
            <div className="export-card-beschrijving mt-1">Locatie pas zichtbaar bij een hogere trust score.</div>
          )}
        </div>

        <div className="card p-3">
          <div className="section-label mb-2">Omschrijving</div>
          {toon.metadata && melding.description ? (
            <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{melding.description}</div>
          ) : (
            <div className="export-card-beschrijving">Omschrijving pas zichtbaar bij een hogere trust score.</div>
          )}
          {toon.metadata && melding.weather?.wind_speed != null && (
            <div className="card p-2 mt-2">
              <div className="section-label mb-1" style={{ fontSize: '0.65rem' }}>Weerdata op moment van melding</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.75rem' }}>
                <span>Wind</span><span>{melding.weather.wind_speed} km/h {melding.richting_compass || ''}</span>
                {melding.weather.temperature != null && <><span>Temperatuur</span><span>{melding.weather.temperature}°C</span></>}
                {melding.weather.humidity != null && <><span>Luchtvochtigheid</span><span>{melding.weather.humidity}%</span></>}
                {melding.wind_subjectief && <><span>Wind (subjectief)</span><span>{melding.wind_subjectief}</span></>}
              </div>
            </div>
          )}
        </div>

        <div className="card p-3">
          <div className="section-label mb-2">Foto's</div>
          {!toon.fotos && (
            <div className="export-card-beschrijving">Foto's pas zichtbaar bij een hoge trust score binnen deze groep.</div>
          )}
          {toon.fotos && bestandenFout && <div className="export-card-beschrijving" style={{ color: 'var(--danger)' }}>Laden mislukt: {bestandenFout}</div>}
          {toon.fotos && bestanden == null && !bestandenFout && <div className="export-card-beschrijving">Foto's laden...</div>}
          {toon.fotos && bestanden?.length === 0 && <div className="export-card-beschrijving">Geen foto's bij deze melding.</div>}
          {toon.fotos && bestanden?.length > 0 && (
            <div className="photo-grid">
              {bestanden.map((f, idx) => {
                const previewSrc = f.thumbnail || f.dataUrl;
                const isVideo = f.type?.startsWith('video/');
                return (
                  <div key={`${f.name}-${idx}`} className="photo-grid-item" onClick={() => setLightboxIndex(idx)}>
                    {isVideo ? <div className="photo-grid-video">🎥</div> : <img src={previewSrc} className="photo-grid-thumb" alt={f.name || ''} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {lightboxIndex != null && bestanden?.length > 0 && (
        <Lightbox
          bestanden={bestanden}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
