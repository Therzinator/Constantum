import { useEffect, useState } from 'react';
import { idbCountBijlagen, idbVerwijderVerweesdeBijlagen } from '../../lib/storage/indexedDB.js';
import { Toast } from '../ui/Toast.jsx';
import { PrullenbakCard } from '../export/PrullenbakCard.jsx';
import { NotificatieInstellingen } from '../notificaties/NotificatieInstellingen.jsx';
import { DeelVoorkeurInstelling } from '../notificaties/DeelVoorkeurInstelling.jsx';
import { DashboardGpsInstelling } from './DashboardGpsInstelling.jsx';
import { DeeltokenGenerator } from '../notificaties/DeeltokenGenerator.jsx';
import { KNMIInstellingen } from '../export/KNMIInstellingen.jsx';
import { TrustIndicator } from '../export/TrustIndicator.jsx';
import { useGebruikersProfiel } from '../../hooks/useGebruikersProfiel.js';
import '../export/ExportPage.css';

// Fase G — eigen Instellingen-pagina. Komt overeen met de
// opslag-opschonen/gevaarzone-kaarten op de Instellingen-pagina uit
// docs/index.html (regel 1569-1602), plus de account-/notificatie-
// instellingen die tot nu toe tijdelijk in ExportPage stonden (zie
// historische comment daar). ExportPage blijft puur export/backup/import.
export function InstellingenPage({ meldingenApi, gebruikerRol, user, laadVanCloud, notificatieApi, thuislocatie }) {
  const { meldingen, verwijderAlleMeldingenLokaal } = meldingenApi;
  const [idbCount, setIdbCount] = useState(null);
  const [melding, setMelding] = useState(null);
  const profiel = useGebruikersProfiel(user);

  useEffect(() => {
    idbCountBijlagen().then(setIdbCount);
  }, [meldingen]);

  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  const handleOpslagOpschonen = async () => {
    const geldigeIds = new Set(meldingen.map((m) => m.id));
    const aantal = await idbVerwijderVerweesdeBijlagen(geldigeIds);
    if (aantal === 0) toon('Geen verouderde bijlagen gevonden', 'success');
    else toon(`✓ ${aantal} verouderde bijlagen verwijderd`, 'success');
    idbCountBijlagen().then(setIdbCount);
  };

  const handleAllesVerwijderen = async () => {
    if (!confirm('⚠️ WAARSCHUWING: Alle meldingen worden permanent verwijderd. Maak eerst een backup!\n\nDoorgaan?')) return;
    if (!confirm('Weet u het zeker? Dit kan NIET ongedaan worden gemaakt.')) return;
    await verwijderAlleMeldingenLokaal();
    toon('Alle data verwijderd (localStorage + IndexedDB)', 'error');
  };

  return (
    <div className="p-4 export-page">
      <div>
        <div className="export-titel">Instellingen</div>
        <div className="export-subtitel">Account, notificaties en opslagbeheer</div>
      </div>

      <TrustIndicator profiel={profiel} />

      <NotificatieInstellingen notificatieApi={notificatieApi} />

      <DeelVoorkeurInstelling />

      <DashboardGpsInstelling />

      <DeeltokenGenerator user={user} thuislocatie={thuislocatie} />

      <KNMIInstellingen />

      <div className="card p-4 export-opschonen">
        <div className="section-label mb-2" style={{ color: 'var(--info)' }}>🧹 Opslag Opschonen</div>
        <div className="export-card-beschrijving mb-3">
          Verwijdert tijdelijke cache en oude previews uit IndexedDB. <strong>Meldingen blijven behouden.</strong>
          {idbCount != null && <> Huidig aantal bijlagen in IndexedDB: <strong>{idbCount}</strong>.</>}
        </div>
        <button type="button" className="btn-outline px-4 py-2" style={{ borderColor: 'var(--info)', color: 'var(--info)' }} onClick={handleOpslagOpschonen}>
          🧹 Verwijder bijlagen zonder melding
        </button>
      </div>

      <div className="card p-4 export-gevaarzone">
        <div className="section-label mb-2" style={{ color: 'var(--danger)' }}>⚠️ Gevaarzone</div>
        <div className="export-card-beschrijving mb-3">Verwijder alle lokaal opgeslagen meldingen. Dit kan niet ongedaan worden gemaakt.</div>
        <button type="button" className="btn-outline px-4 py-2" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleAllesVerwijderen}>
          🗑️ Alle data verwijderen
        </button>
      </div>

      <PrullenbakCard gebruikerRol={gebruikerRol} user={user} laadVanCloud={laadVanCloud} />

      <Toast melding={melding} />
    </div>
  );
}
