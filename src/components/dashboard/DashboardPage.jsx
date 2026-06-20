import { useState } from 'react';
import { DashboardKaart } from './DashboardKaart.jsx';
import { MaandGrafiek } from './MaandGrafiek.jsx';
import { MeldingCard } from '../meldingen/MeldingCard.jsx';
import { MeldingDetailModal } from '../melding/MeldingDetailModal.jsx';
import { dashboardStatistieken } from '../../lib/meldingen/statistieken.js';
import './DashboardPage.css';

// Komt overeen met de pagina 'dashboard' (updateDashboard/renderCharts) uit
// docs/index.html: statistieken, kaart met driftlagen, maandgrafiek en de
// 5 meest recente meldingen.
export function DashboardPage({ meldingenApi, user, gebruikerRol, thuislocatie }) {
  const { meldingen } = meldingenApi;
  const [geselecteerdId, setGeselecteerdId] = useState(null);

  const { totaal, dezeMaand, dezeWeek, topWind } = dashboardStatistieken(meldingen);
  const recent = [...meldingen]
    .sort((a, b) => new Date(b.timestamp_local) - new Date(a.timestamp_local))
    .slice(0, 5);
  const geselecteerd = geselecteerdId ? meldingen.find((m) => m.id === geselecteerdId) : null;

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
        <DashboardKaart meldingen={meldingen} thuislocatie={thuislocatie} onMeldingSelecteren={setGeselecteerdId} />
      </div>

      <div className="card p-3 dashboard-section">
        <div className="section-label mb-2">Meldingen per maand</div>
        <MaandGrafiek meldingen={meldingen} />
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
            />
          ))
        )}
      </div>

      {geselecteerd && (
        <MeldingDetailModal melding={geselecteerd} alleMeldingen={meldingen} onClose={() => setGeselecteerdId(null)} />
      )}
    </div>
  );
}
