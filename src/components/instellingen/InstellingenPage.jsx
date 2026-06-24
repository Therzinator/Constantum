import { useEffect, useState } from 'react';
import { idbCountBijlagen, idbVerwijderVerweesdeBijlagen } from '../../lib/storage/indexedDB.js';
import { Toast } from '../ui/Toast.jsx';
import { Collapsible } from '../ui/Collapsible.jsx';
import { PrullenbakCard } from '../export/PrullenbakCard.jsx';
import { GegevensPrivacyInstelling } from './GegevensPrivacyInstelling.jsx';
import { TrustIndicator } from '../export/TrustIndicator.jsx';
import { PrivacyVerklaringModal } from '../onboarding/PrivacyVerklaringModal.jsx';
import { AlgemeneVoorwaardenModal } from '../onboarding/AlgemeneVoorwaardenModal.jsx';
import { useGebruikersProfiel } from '../../hooks/useGebruikersProfiel.js';
import '../export/ExportPage.css';

// Fase G — eigen Instellingen-pagina. Komt overeen met de
// opslag-opschonen/gevaarzone-kaarten op de Instellingen-pagina uit
// docs/index.html (regel 1569-1602), plus de account-/notificatie-
// instellingen die tot nu toe tijdelijk in ExportPage stonden (zie
// historische comment daar). ExportPage blijft puur export/backup/import.
export function InstellingenPage({ meldingenApi, gebruikerRol, user, laadVanCloud, thuislocatie, onOpenHandleiding, onUitloggen, onNavigeerFeedback }) {
  const { meldingen, verwijderAlleMeldingenLokaal } = meldingenApi;
  const [idbCount, setIdbCount] = useState(null);
  const [melding, setMelding] = useState(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [voorwaardenOpen, setVoorwaardenOpen] = useState(false);
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
    <div className="export-page">
      <div>
        <div className="export-titel">Instellingen</div>
        <div className="export-subtitel">Account, notificaties en opslagbeheer</div>
      </div>

      <TrustIndicator profiel={profiel} />

      <GegevensPrivacyInstelling user={user} meldingenApi={meldingenApi} thuislocatie={thuislocatie} onUitloggen={onUitloggen} />

      <div className="card p-4">
        <div className="section-label mb-3">💬 Feedback &amp; vragen</div>
        <div className="export-card-beschrijving mb-3">
          Technisch probleem gevonden, een vraag over een functie, of een
          opmerking/compliment? Meld het hier.
        </div>
        <button type="button" className="btn-outline export-knop" onClick={onNavigeerFeedback}>
          💬 Naar Feedback-paneel
        </button>
      </div>

      <Collapsible icoon="🌿" titel="Over SpuitLogger">
        <button type="button" className="btn-outline export-knop" onClick={onOpenHandleiding}>
          📖 Handleiding opnieuw bekijken
        </button>
      </Collapsible>

      <Collapsible icoon="🧹" titel="Opslag opschonen" kleur="var(--info)">
        <div className="export-card-beschrijving mb-3">
          Verwijdert tijdelijke cache en oude previews uit IndexedDB. <strong>Meldingen blijven behouden.</strong>
          {idbCount != null && <> Huidig aantal bijlagen in IndexedDB: <strong>{idbCount}</strong>.</>}
        </div>
        <button type="button" className="btn-outline export-knop" style={{ borderColor: 'var(--info)', color: 'var(--info)' }} onClick={handleOpslagOpschonen}>
          🧹 Verwijder bijlagen zonder melding
        </button>
      </Collapsible>

      <Collapsible icoon="⚠️" titel="Gevaarzone" kleur="var(--danger)">
        <div className="export-card-beschrijving mb-3">Verwijder alle lokaal opgeslagen meldingen. Dit kan niet ongedaan worden gemaakt.</div>
        <button type="button" className="btn-outline export-knop" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleAllesVerwijderen}>
          🗑️ Alle data verwijderen
        </button>
      </Collapsible>

      <Collapsible icoon="⚖️" titel="Juridisch">
        <div className="instellingen-knoppenrij">
          <button type="button" className="btn-outline export-knop" onClick={() => setPrivacyOpen(true)}>
            📄 Privacyverklaring
          </button>
          <button type="button" className="btn-outline export-knop" onClick={() => setVoorwaardenOpen(true)}>
            📜 Algemene Voorwaarden
          </button>
        </div>
      </Collapsible>

      <PrullenbakCard gebruikerRol={gebruikerRol} user={user} laadVanCloud={laadVanCloud} />

      {privacyOpen && <PrivacyVerklaringModal onSluiten={() => setPrivacyOpen(false)} />}
      {voorwaardenOpen && <AlgemeneVoorwaardenModal onSluiten={() => setVoorwaardenOpen(false)} />}
      <Toast melding={melding} />
    </div>
  );
}
