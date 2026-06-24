import { useState } from 'react';
import { laadDeelVoorkeur, slaDeelVoorkeurOp } from '../../lib/notificaties/deelvoorkeur.js';

// Coordinatie & Admin systeem, Fase 3 — standaardvoorkeur voor opt_in_buurt
// bij nieuwe meldingen. Stond voorlopig in ExportPage tot er een eigen
// Instellingen-pagina was (Fase G); nu inline in AccountMenu.jsx.
export function DeelVoorkeurInstelling() {
  const [aan, setAan] = useState(() => laadDeelVoorkeur());

  const handleChange = (e) => {
    const checked = e.target.checked;
    setAan(checked);
    slaDeelVoorkeurOp(checked);
  };

  return (
    <div className="card p-4">
      <div className="section-label mb-3">🤝 Meldingen delen met de buurt</div>
      <div className="export-card-beschrijving mb-3">
        Standaardwaarde voor nieuwe meldingen. Andere gebruikers binnen
        bereik van hun thuislocatie zien de melding dan ook. Per melding
        blijft dit aanpasbaar in het formulier.
      </div>
      <label className="export-info-rij" style={{ cursor: 'pointer' }}>
        <span>Standaard delen met de buurt</span>
        <input type="checkbox" checked={aan} onChange={handleChange} />
      </label>
    </div>
  );
}
