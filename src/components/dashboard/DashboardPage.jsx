import { lazy, Suspense, useMemo, useState } from 'react';
import { MaandGrafiek } from './MaandGrafiek.jsx';
import { MeldingCard } from '../meldingen/MeldingCard.jsx';
import { dashboardStatistieken } from '../../lib/meldingen/statistieken.js';
import { laadGpsCache } from '../../lib/geo/gpsCache.js';
import { laadNotificatieInstellingen } from '../../lib/notificaties/buurtMelding.js';
import { haversineAfstand } from '../../lib/geo/haversine.js';
import './DashboardPage.css';

// Lazy geladen — beide trekken OpenLayers (~300-400KB) mee, dat hoeft niet
// in de hoofdbundel te zitten voor gebruikers die deze pagina niet openen.
const DashboardKaart = lazy(() => import('./DashboardKaart.jsx').then((m) => ({ default: m.DashboardKaart })));
const MeldingDetailModal = lazy(() => import('../melding/MeldingDetailModal.jsx').then((m) => ({ default: m.MeldingDetailModal })));

// Komt overeen met de pagina 'dashboard' (updateDashboard/renderCharts) uit
// docs/index.html: statistieken, kaart met driftlagen, maandgrafiek en de
// 5 meest recente meldingen.
export function DashboardPage({ meldingenApi, user, gebruikerRol, thuislocatie }) {
  const { meldingen } = meldingenApi;
  const [geselecteerdId, setGeselecteerdId] = useState(null);
  // Zelfde bereik-instelling als Instellingen → Notificaties (max 5 km, zie
  // buurtMelding.js) — dit dashboard toont gedeelde meldingen van ANDEREN
  // dus nooit verder weg dan dat ingestelde bereik. Eigen meldingen (incl.
  // nog niet gesynchroniseerde, zonder user_id) blijven altijd zichtbaar.
  // De database (migratie 0009) handhaaft daarbovenop een harde grens van
  // 5 km, onafhankelijk van deze client-instelling.
  const { radiusMeter } = laadNotificatieInstellingen();
  const meldingenInBereik = useMemo(() => meldingen.filter((m) => {
    if (!m.user_id || m.user_id === user?.id) return true;
    if (!m.opt_in_buurt) return false;
    if (!thuislocatie?.lat || !thuislocatie?.lng || m.gps?.lat == null || m.gps?.lng == null) return false;
    return haversineAfstand(thuislocatie.lat, thuislocatie.lng, m.gps.lat, m.gps.lng) <= radiusMeter;
  }), [meldingen, user, thuislocatie, radiusMeter]);

  const { totaal, dezeMaand, dezeWeek, topWind } = dashboardStatistieken(meldingenInBereik);
  const recent = [...meldingenInBereik]
    .sort((a, b) => new Date(b.timestamp_local) - new Date(a.timestamp_local))
    .slice(0, 5);
  const geselecteerd = geselecteerdId ? meldingenInBereik.find((m) => m.id === geselecteerdId) : null;
  // Gecachete laatst bekende GPS-fix (lib/geo/gpsCache.js, gevuld door de
  // dashboardkaart) — geen eigen watchPosition hier nodig voor alleen de
  // afstandsindicatie op de "Recente meldingen"-kaartjes.
  const gpsLocatie = laadGpsCache();

  return (
    <div className="p-4">
      <div className="dashboard-stats">
        <div className="card dashboard-stat-card">
          <div className="dashboard-stat-label">Totaal</div>
          <div className="dashboard-stat-value">{totaal}</div>
        </div>
        <div className="card dashboard-stat-card">
          <div className="dashboard-stat-label">Deze maand</div>
          <div className="dashboard-stat-value">{dezeMaand}</div>
        </div>
        <div className="card dashboard-stat-card">
          <div className="dashboard-stat-label">Deze week</div>
          <div className="dashboard-stat-value">{dezeWeek}</div>
        </div>
        <div className="card dashboard-stat-card">
          <div className="dashboard-stat-label">Meest wind</div>
          <div className="dashboard-stat-value">{topWind}</div>
        </div>
      </div>

      <div className="dashboard-section">
        <Suspense fallback={<div className="dashboard-leeg">Kaart laden...</div>}>
          <DashboardKaart meldingen={meldingenInBereik} thuislocatie={thuislocatie} gebruikerRol={gebruikerRol} onMeldingSelecteren={setGeselecteerdId} />
        </Suspense>
      </div>

      <div className="card p-3 dashboard-section">
        <div className="section-label mb-2">Meldingen per maand</div>
        <MaandGrafiek meldingen={meldingenInBereik} />
      </div>

      <div className="dashboard-section">
        <div className="dashboard-section-titel">Recente meldingen</div>
        {recent.length === 0 ? (
          <div className="dashboard-leeg">Nog geen meldingen geregistreerd.</div>
        ) : (
          recent.map((m) => (
            <MeldingCard
              key={m.id}
              melding={m}
              user={user}
              gebruikerRol={gebruikerRol}
              onSelecteren={setGeselecteerdId}
              compact
              toonLocatieKaartje
              gpsLocatie={gpsLocatie}
            />
          ))
        )}
      </div>

      {geselecteerd && (
        <Suspense fallback={null}>
          <MeldingDetailModal melding={geselecteerd} alleMeldingen={meldingenInBereik} onClose={() => setGeselecteerdId(null)} />
        </Suspense>
      )}
    </div>
  );
}
