import { useState } from 'react';
import { laadGpsVoorkeur, slaGpsVoorkeurOp } from '../../lib/dashboard/gpsVoorkeur.js';

// Schakelt de live GPS-pin op de dashboardkaart aan/uit. Bij aanzetten
// vraagt de browser bij het volgende bezoek aan het dashboard om
// locatietoestemming en verschijnt de pin automatisch — geen extra knop
// nodig op de kaart zelf.
export function DashboardGpsInstelling() {
  const [aan, setAan] = useState(() => laadGpsVoorkeur());

  const handleChange = (e) => {
    const checked = e.target.checked;
    setAan(checked);
    slaGpsVoorkeurOp(checked);
  };

  return (
    <div className="card p-4">
      <div className="section-label mb-3">📍 Live GPS-pin op dashboard</div>
      <div className="export-card-beschrijving mb-3">
        Toont je huidige locatie automatisch op de dashboardkaart. Vereist
        locatietoestemming in de browser.
      </div>
      <label className="export-info-rij" style={{ cursor: 'pointer' }}>
        <span>Mijn locatie tonen op dashboard</span>
        <input type="checkbox" checked={aan} onChange={handleChange} />
      </label>
    </div>
  );
}
