import { useEffect, useState } from 'react';
import { degToCompass, spuitWindOordeel } from '../../lib/drift/oordeel.js';
import { idbGetBijlagen } from '../../lib/storage/indexedDB.js';
import { melderCode } from '../../utils/format.js';
import { haalKNMIWeerdata } from '../../lib/weather/knmi.js';
import { perceelStatistieken } from '../../lib/meldingen/statistieken.js';
import { analyseerSpuitpatroon } from '../../lib/meldingen/spuitpatroon.js';
import { DriftZoneKaart } from './DriftZoneKaart.jsx';
import { DriftZoneModal } from './DriftZoneModal.jsx';
import { Lightbox } from './Lightbox.jsx';
import './MeldingDetailModal.css';

const SPUITPATROON_KLEUR = { danger: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)', muted: 'var(--text-muted)' };

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

const DRIFT_LABELS = {
  nevel_zichtbaar: '🌫️ Nevel/drift zichtbaar',
  druppels_voelbaar: '💦 Druppels voelbaar',
  drift_ver: '📏 Drift >10m zichtbaar',
  geur_direct: '👃 Geur direct',
  ogen_keel: '👁️ Ogen/keel irritatie'
};

// React-versie van showMeldingDetail() uit docs/index.html (zonder
// perceelFrequentieBadge/spuitpatroonHTML/Natura2000 — die horen bij een
// latere fase). Laadt ontbrekende foto-dataUrls uit IndexedDB voor de
// foto-grid en lightbox, net als openLightboxFromSaved().
export function MeldingDetailModal({ melding, alleMeldingen, onClose }) {
  const [bestanden, setBestanden] = useState(melding.bestanden || []);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [driftZoneOpen, setDriftZoneOpen] = useState(false);
  const [knmiData, setKnmiData] = useState(null);
  const [knmiBezig, setKnmiBezig] = useState(false);

  const haalKNMIOp = async () => {
    if (!melding.gps?.lat || !melding.gps?.lng) return;
    setKnmiBezig(true);
    try {
      const data = await haalKNMIWeerdata(melding.gps.lat, melding.gps.lng, melding.timestamp_local);
      setKnmiData(data || { leeg: true });
    } finally {
      setKnmiBezig(false);
    }
  };

  const perceelStats = melding.perceelnummer ? perceelStatistieken(alleMeldingen || [])[melding.perceelnummer] : null;
  const spuitpatroon = analyseerSpuitpatroon(melding).indicaties.filter((i) => i.score > 0);

  useEffect(() => {
    let actief = true;
    idbGetBijlagen(melding.id).then((idbBijlagen) => {
      if (!actief) return;
      setBestanden((huidige) =>
        huidige.map((f) => {
          const idb = idbBijlagen.find((b) => b.hash === f.hash || b.name === f.name);
          return idb ? { ...f, dataUrl: idb.dataUrl } : f;
        })
      );
    });
    return () => { actief = false; };
  }, [melding.id]);

  return (
    <div className="detail-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="detail-modal">
        <button type="button" className="detail-modal-close" onClick={onClose} aria-label="Sluiten">✕</button>

        <div className="detail-modal-badges">
          <span className={`badge ${TYPE_BADGE[melding.type] || 'badge-muted'}`}>{TYPE_LABEL[melding.type] || melding.type}</span>
          <span className="badge badge-muted">{melding.id}</span>
          {melding.melder_email && <span className="badge badge-muted">{melderCode(melding.melder_email)}</span>}
        </div>

        <div className="card p-3">
          <div className="section-label mb-2">Tijdregistratie</div>
          <div className="detail-mono-block">
            <div><span className="label">Lokaal: </span>{melding.date} {melding.time}</div>
            <div><span className="label">UTC: </span>{melding.timestamp_utc}</div>
            <div><span className="label">Tijdzone: </span>{melding.timezone}</div>
          </div>
        </div>

        {melding.gps?.lat && melding.gps?.lng && (
          <div className="card p-3">
            <div className="detail-card-row mb-2">
              <div className="section-label">Locatie &amp; Driftzone</div>
              {melding.weather?.wind_dir != null && (
                <button type="button" className="btn-outline px-2 py-1" style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem' }} onClick={() => setDriftZoneOpen(true)}>
                  🔍 Volledig
                </button>
              )}
            </div>
            <DriftZoneKaart melding={melding} hoogte={200} />
            <div className="detail-mono-block" style={{ marginTop: 8 }}>
              {melding.gps.lat.toFixed(6)}°N · {melding.gps.lng.toFixed(6)}°E
              {melding.gps.accuracy ? ` (±${melding.gps.accuracy.toFixed(0)}m)` : ''}
            </div>
          </div>
        )}

        <div className="card p-3">
          <div className="section-label mb-2">Omschrijving</div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{melding.description}</div>
        </div>

        <div className="card p-3">
          <div className="section-label mb-2">Observaties</div>
          <div className="detail-obs-grid">
            <div><span style={{ color: 'var(--text-muted)' }}>Geur:</span> {melding.geur_intensiteit != null ? `${melding.geur_intensiteit}/5` : 'niet aangegeven'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Wind:</span> {melding.wind_subjectief}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Richting:</span> {melding.richting_deg}° ({melding.richting_compass})</div>
          </div>

          {melding.gezondheidsklachten?.length > 0 && (
            <div className="mt-2">
              <div className="section-label">Gezondheid</div>
              <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: 4 }}>{melding.gezondheidsklachten.join(', ')}</div>
            </div>
          )}

          {melding.activiteiten?.length > 0 && (
            <div className="mt-2">
              <div className="section-label">Activiteiten</div>
              <div style={{ color: 'var(--warning)', fontSize: '0.75rem', marginTop: 4 }}>{melding.activiteiten.join(', ')}</div>
            </div>
          )}

          {perceelStats && perceelStats.totaal >= 2 && (
            <div className="detail-perceel-frequentie" style={{ color: perceelStats.ditJaar >= 5 ? 'var(--danger)' : perceelStats.ditJaar >= 3 ? 'var(--warning)' : 'var(--accent)' }}>
              📊 {perceelStats.ditJaar}× gemeld afgelopen jaar{perceelStats.bovenWindNorm > 0 ? ` · ${perceelStats.bovenWindNorm}× boven windnorm` : ''}
            </div>
          )}

          {spuitpatroon.length > 0 && (
            <div className="detail-spuitpatroon">
              {spuitpatroon.map((i) => (
                <span key={i.label} style={{ color: SPUITPATROON_KLEUR[i.kleur] }} title={i.reden}>{i.label}</span>
              ))}
            </div>
          )}

          {(melding.bedrijfsnaam || melding.gewas || melding.perceelnummer || melding.afstand_woning != null) && (
            <div className="detail-teler-block">
              {melding.bedrijfsnaam && <div>🏢 {melding.bedrijfsnaam}</div>}
              {melding.gewas && <div>🌱 {melding.gewas}</div>}
              {melding.perceelnummer && <div style={{ fontFamily: 'var(--mono)' }}>📋 {melding.perceelnummer}</div>}
              {melding.afstand_woning != null && (
                <div style={{ color: melding.afstand_woning < 50 ? 'var(--danger)' : melding.afstand_woning < 100 ? 'var(--warning)' : 'var(--accent)' }}>
                  📏 {melding.afstand_woning}m tot perceel met woonbestemming{melding.afstand_woning < 50 ? ' ⛔ ONDER 50m NORM' : ''}
                </div>
              )}
              {melding.wind_naar_woning?.waait && (() => {
                const w = melding.wind_naar_woning;
                const toeRichting = w.windToeRichting ?? (w.windDeg + 180) % 360;
                return (
                  <div style={{ color: 'var(--danger)', fontWeight: 700 }}>
                    💨 Wind waait richting de woning. Wind komt uit {degToCompass(w.windDeg)} ({w.windDeg}°,
                    dus naartoe {degToCompass(toeRichting)}/{toeRichting}°),
                    woning ligt vanaf het meldpunt op {degToCompass(w.hoekNaarWoning)}/{w.hoekNaarWoning}°
                  </div>
                );
              })()}
            </div>
          )}

          {melding.drift_waarneming?.length > 0 && (
            <div className="detail-drift-block">
              <div className="section-label" style={{ color: 'var(--danger)', marginBottom: 4 }}>Drift &amp; Overlast</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>
                {melding.drift_waarneming.map((v) => DRIFT_LABELS[v] || v).join(' · ')}
              </div>
            </div>
          )}
        </div>

        {melding.natura2000 && (
          <div className="card p-3 detail-natura2000-block">
            <div className="section-label mb-2">🌿 Natura 2000</div>
            <div style={{ fontSize: '0.8rem' }}>Nabij: {melding.natura2000.naam}</div>
            {melding.natura2000.lat != null && (
              <div className="detail-mono-block" style={{ marginTop: 4 }}>
                {melding.natura2000.lat.toFixed(6)}°N · {melding.natura2000.lng.toFixed(6)}°E
              </div>
            )}
          </div>
        )}

        {melding.kwetsbare_locaties?.length > 0 && (
          <div className="card p-3 detail-kwetsbaar-block">
            <div className="section-label mb-2" style={{ color: 'var(--danger)' }}>⚠️ Kwetsbare locaties in de buurt</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {melding.kwetsbare_locaties.map((tekst) => <div key={tekst}>• {tekst}</div>)}
            </div>
          </div>
        )}

        {melding.weather && melding.weather.wind_speed != null && (
          <div className="card p-3">
            <div className="section-label mb-2">Weerdata ({melding.weather.source})</div>
            <div className="detail-obs-grid">
              <div>🌬️ {melding.weather.wind_speed} km/h</div>
              <div>↗️ {melding.weather.wind_dir}° {degToCompass(melding.weather.wind_dir)}</div>
              <div>💨 stoten: {melding.weather.wind_gusts} km/h</div>
              <div>🌡️ {melding.weather.temperature}°C</div>
              <div>💧 {melding.weather.humidity}%</div>
              <div>🌂 {melding.weather.precipitation} mm</div>
              <div>📊 {melding.weather.pressure} hPa</div>
              {melding.weather.pasquill && (
                <div>📈 Pasquill: {melding.weather.pasquill.klasse} ({melding.weather.pasquill.label})</div>
              )}
            </div>
            {(() => {
              const o = spuitWindOordeel(melding.weather.wind_speed, melding.weather.wind_gusts, melding.drift_waarneming);
              return (
                <div className="detail-weer-oordeel" style={{ color: o.kleur, borderColor: `${o.kleur}44`, background: `${o.kleur}18` }}>
                  {o.icoon} Spuitrichtlijn: {o.tekst}
                </div>
              );
            })()}

            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {!knmiData ? (
                <button type="button" className="btn-outline px-2 py-1" style={{ fontSize: '0.6rem' }} onClick={haalKNMIOp} disabled={knmiBezig}>
                  {knmiBezig ? '⏳ Ophalen...' : '🌦️ Verificeer met archief-weerdata'}
                </button>
              ) : knmiData.leeg ? (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Geen weerdata gevonden voor dit tijdstip/locatie</div>
              ) : (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>
                  <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>✓ Weerarchief: {knmiData.station}</div>
                  <div>Wind: {knmiData.windsnelheid} m/s · {knmiData.windrichting}°</div>
                  <div>Temperatuur: {knmiData.temperatuur}°C · Vochtigheid: {knmiData.luchtvochtigheid}%</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{knmiData.bron}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {bestanden.length > 0 && (
          <div className="card p-3">
            <div className="section-label mb-2">Bestanden ({bestanden.length})</div>
            <div className="photo-grid">
              {bestanden.map((f, idx) => {
                const previewSrc = f.thumbnail || f.dataUrl;
                const isVideo = f.type?.startsWith('video/');
                return (
                  <div key={`${f.name}-${idx}`} className="photo-grid-item" onClick={() => setLightboxIndex(idx)}>
                    {isVideo
                      ? <div className="photo-grid-video">🎥</div>
                      : <img src={previewSrc} className="photo-grid-thumb" alt={f.name || ''} />}
                    <div className="photo-hash-badge" style={f.exif?.datetime_original ? { background: 'rgba(0,212,170,0.85)', bottom: 22 } : undefined}>
                      {f.exif?.datetime_original ? 'EXIF ✓' : 'SHA256'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card p-3">
          <div className="section-label mb-2">Integriteitsverificatie</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>SHA-256 Hash</div>
          <div className="hash-display">{melding.hash}</div>
          {melding.rfc3161 ? (
            <div className="detail-rfc3161-ok">
              <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                ✓ RFC 3161 Tijdstempel
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                🕐 {new Date(melding.rfc3161.timestamp).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
                TSA: {melding.rfc3161.tsa}
              </div>
              {melding.rfc3161.serial && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Serial: {melding.rfc3161.serial}
                </div>
              )}
            </div>
          ) : (
            <div className="detail-rfc3161-geen">⚠️ Geen RFC 3161 tijdstempel, mogelijk offline bij aanmaken</div>
          )}
          <div className="section-label mt-3 mb-1">Apparaat</div>
          <div className="detail-mono-block" style={{ wordBreak: 'break-all' }}>{melding.device?.substring(0, 120)}...</div>
        </div>
      </div>

      {lightboxIndex != null && (
        <Lightbox
          bestanden={bestanden}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {driftZoneOpen && <DriftZoneModal melding={melding} onClose={() => setDriftZoneOpen(false)} />}
    </div>
  );
}
