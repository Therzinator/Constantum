import { degToCompass } from '../../lib/drift/oordeel.js';
import { melderCode } from '../../utils/format.js';
import { magVerwijderen } from '../../lib/rollen.js';
import { SUPABASE_ENABLED } from '../../lib/supabase/client.js';
import { haversineAfstand } from '../../lib/geo/haversine.js';
import { MeldingMiniKaart } from './MeldingMiniKaart.jsx';
import './MeldingCard.css';

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

const SYNC_BADGE = {
  synced: ['sync-synced', 'Gesynchroniseerd'],
  lokaal: ['sync-lokaal', 'Alleen lokaal'],
  sync_mislukt: ['sync-error', 'Sync mislukt'],
  pending: ['sync-pending', 'In wachtrij']
};

// Komt overeen met renderMeldingCard (niet-compacte variant) uit docs/index.html.
// `user`/`gebruikerRol` komen uit hooks/useAuth.js. Klikken op de kaart opent
// de detail-modal via onSelecteren (showMeldingDetail-equivalent).
export function MeldingCard({ melding, user, gebruikerRol, onVerwijderen, onSelecteren, compact = false, toonLocatieKaartje = false, gpsLocatie = null }) {
  const d = new Date(melding.timestamp_local);
  const dateStr = d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  const syncStatus = melding.sync_status || (melding.supabase_id ? 'synced' : 'lokaal');
  const [syncCls, syncLabel] = SYNC_BADGE[syncStatus] || SYNC_BADGE.lokaal;
  const magVerwijderenDeze = magVerwijderen(gebruikerRol, user, melding.melder_email, melding.user_id);
  const maxLengte = compact ? 80 : 120;
  const omschrijving = melding.description.length > maxLengte
    ? `${melding.description.substring(0, maxLengte)}...`
    : melding.description;

  const heeftLocatie = toonLocatieKaartje && melding.gps?.lat != null && melding.gps?.lng != null;
  const afstandTekst = heeftLocatie && gpsLocatie
    ? `Melding ${Math.round(haversineAfstand(gpsLocatie.lat, gpsLocatie.lng, melding.gps.lat, melding.gps.lng))} meter vanaf jouw positie gedaan.`
    : null;
  const typeIcoon = (TYPE_LABEL[melding.type] || '📍 ').split(' ')[0];

  return (
    <div className="card melding-card">
      <div className="melding-card-body" onClick={() => onSelecteren(melding.id)} style={{ cursor: 'pointer' }}>
        <div className="melding-card-row">
          <div className="melding-card-main">
            <div className="melding-card-top">
              <div className="melding-card-badges">
                <span className={`badge ${TYPE_BADGE[melding.type] || 'badge-muted'}`}>
                  {TYPE_LABEL[melding.type] || melding.type}
                </span>
                {SUPABASE_ENABLED && (
                  <span className={`sync-badge ${syncCls}`}>
                    <span className="sync-dot" />
                    {syncLabel}
                  </span>
                )}
              </div>
              <span className="melding-card-date">{dateStr} {timeStr}</span>
            </div>

            {compact ? (
              // Compacte variant ("Recente meldingen"): rij 1 is hierboven
              // (badges + datum, .melding-card-top), rij 2 combineert
              // omschrijving en meta-iconen op één regel — bewust precies
              // twee rijen data, geen losse derde rij.
              <div className="melding-card-compact-rij2">
                <div className="melding-card-desc">{omschrijving}</div>
                <div className="melding-card-meta">
                  {melding.weather?.wind_speed != null && (
                    <span style={{ color: 'var(--info)', fontSize: '0.65rem' }}>
                      💨 {melding.weather.wind_speed} km/h {degToCompass(melding.weather.wind_dir)}
                    </span>
                  )}
                  {melding.gezondheidsklachten?.length > 0 && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.65rem' }}>
                      🏥 {melding.gezondheidsklachten.length} klacht(en)
                    </span>
                  )}
                  {melding.bestanden?.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                      📎 {melding.bestanden.length} bestand(en)
                    </span>
                  )}
                  <span className="melding-id">{melding.id}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="melding-card-desc">{omschrijving}</div>
                <div className="melding-card-meta">
                  {melding.weather?.wind_speed != null && (
                    <span style={{ color: 'var(--info)', fontSize: '0.65rem' }}>
                      💨 {melding.weather.wind_speed} km/h {degToCompass(melding.weather.wind_dir)}
                    </span>
                  )}
                  {melding.gezondheidsklachten?.length > 0 && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.65rem' }}>
                      🏥 {melding.gezondheidsklachten.length} klacht(en)
                    </span>
                  )}
                  {melding.bestanden?.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                      📎 {melding.bestanden.length} bestand(en)
                    </span>
                  )}
                  {melding.melder_email && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                      {melderCode(melding.melder_email)}
                    </span>
                  )}
                  <span className="melding-id">{melding.id}</span>
                </div>
              </>
            )}

            {afstandTekst && <div className="melding-card-afstand">📏 {afstandTekst}</div>}

            {!compact && (
              <>
                <div className="hash-display" style={{ marginTop: 8 }}>{melding.hash}</div>
                <div className={`melding-card-rfc3161 ${melding.rfc3161 ? 'ok' : 'geen'}`}>
                  {melding.rfc3161
                    ? `✓ RFC 3161 · ${new Date(melding.rfc3161.timestamp).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`
                    : '⚠️ Geen RFC 3161 tijdstempel'}
                </div>
              </>
            )}
          </div>

          {heeftLocatie && (
            <div className="melding-card-thumb-col">
              <MeldingMiniKaart lat={melding.gps.lat} lng={melding.gps.lng} icoon={typeIcoon} />
            </div>
          )}
        </div>
      </div>

      {!compact && magVerwijderenDeze && (
        <div className="melding-card-footer">
          <button
            type="button"
            className="melding-card-delete"
            title="Verwijder registratie"
            onClick={() => onVerwijderen(melding.id)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
