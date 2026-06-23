import { useEffect, useState } from 'react';
import { markeerHandleidingGezien } from '../../lib/onboarding/handleidingStatus.js';
import { PrivacyVerklaringModal } from './PrivacyVerklaringModal.jsx';
import './HandleidingModal.css';

const AANTAL_STAPPEN = 5;

// Welkomst-/handleiding-wizard. Verschijnt automatisch bij de eerste keer
// dat de app wordt gebruikt (zie App.jsx, gate op handleidingStatus.js) en
// is via Instellingen → "Over SpuitLogger" altijd opnieuw te openen.
export function HandleidingModal({ onSluiten }) {
  const [stap, setStap] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') sluiten(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const sluiten = () => {
    markeerHandleidingGezien();
    onSluiten();
  };

  if (privacyOpen) {
    return <PrivacyVerklaringModal onSluiten={() => setPrivacyOpen(false)} />;
  }

  return (
    <div className="handleiding-overlay" onClick={sluiten}>
      <div
        className="handleiding-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Welkom bij SpuitLogger"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="handleiding-close" onClick={sluiten} aria-label="Sluiten">×</button>

        {stap === 0 && (
          <>
            <div className="handleiding-icoon">🌿</div>
            <div className="handleiding-titel">Welkom bij SpuitLogger</div>
            <div className="handleiding-tekst">
              SpuitLogger is een buurtregistratietool waarmee u spuitactiviteiten met
              gewasbeschermingsmiddelen bij uw woning kunt documenteren. Uw registraties
              zijn juridisch onderbouwd met tijdstempels, weerdata en locatiegegevens —
              klaar om als bewijsmateriaal te dienen.
            </div>
          </>
        )}

        {stap === 1 && (
          <>
            <div className="handleiding-titel">Zo bouwt u een dossier op</div>
            <div className="handleiding-grid">
              <div className="handleiding-grid-item">
                <div className="handleiding-grid-icoon">📍</div>
                <div className="handleiding-grid-label">Markeer de locatie — plaatst een pin op de kaart bij het spuitperceel</div>
              </div>
              <div className="handleiding-grid-item">
                <div className="handleiding-grid-icoon">📸</div>
                <div className="handleiding-grid-label">Maak beeldmateriaal — voeg foto's toe als visueel bewijs</div>
              </div>
              <div className="handleiding-grid-item">
                <div className="handleiding-grid-icoon">🌤️</div>
                <div className="handleiding-grid-label">Automatische weerdata — wind, temperatuur en neerslag</div>
              </div>
              <div className="handleiding-grid-item">
                <div className="handleiding-grid-icoon">📋</div>
                <div className="handleiding-grid-label">Exporteer uw dossier — genereer een juridisch PDF-dossier met één tik</div>
              </div>
            </div>
          </>
        )}

        {stap === 2 && (
          <>
            <div className="handleiding-titel">Samen sterker</div>
            <div className="handleiding-tekst">
              {`SpuitLogger is het krachtigst als meerdere bewoners in uw buurt registreren. Een patroon van meldingen over tijd — van meerdere adressen, met consistente weersomstandigheden — staat juridisch veel sterker dan één enkele melding.

Zo werkt buurtregistratie:
• Elke melder bouwt een eigen privédossier
• U kiest zelf of u meedoet aan het buurtdossier (opt-in, per melding aanpasbaar)
• Een coördinator kan geanonimiseerde dossiers samenvoegen
• Uw identiteit blijft beschermd — u bent zichtbaar als Melder#XXXXXX`}
            </div>
          </>
        )}

        {stap === 3 && (
          <>
            <div className="handleiding-titel">U blijft buiten schot</div>
            <div className="handleiding-tekst">
              {`SpuitLogger is gebouwd met privacy als fundament:
🔐 Uw locatie wordt nooit exact gedeeld — afgerond op buurtniveau
📧 Uw e-mailadres wordt versleuteld opgeslagen (SHA-256)
📷 GPS-coördinaten worden automatisch uit uw foto's verwijderd
🚫 Niemand ziet uw meldingen tenzij u dat zelf kiest`}
            </div>
            <button type="button" className="handleiding-link-knop" onClick={() => setPrivacyOpen(true)}>
              Lees de volledige privacyverklaring →
            </button>
          </>
        )}

        {stap === 4 && (
          <>
            <div className="handleiding-titel">U bent er klaar voor</div>
            <div className="handleiding-tekst">
              Tip: nodig buurtgenoten uit met de Groepsuitnodiging-functie en start samen
              een groep om gezamenlijk een dossier op te bouwen.
            </div>
            <button type="button" className="btn-primary handleiding-cta" onClick={sluiten}>
              Aan de slag →
            </button>
            <div className="handleiding-replay-link">Handleiding later opnieuw bekijken via Instellingen</div>
          </>
        )}

        <div className="handleiding-stippen">
          {Array.from({ length: AANTAL_STAPPEN }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`handleiding-stip ${i === stap ? 'actief' : ''}`}
              aria-label={`Stap ${i + 1}`}
              onClick={() => setStap(i)}
            />
          ))}
        </div>

        {stap < AANTAL_STAPPEN - 1 && (
          <div className="handleiding-navigatie">
            <button
              type="button"
              className="btn-outline px-4 py-2"
              style={{ visibility: stap === 0 ? 'hidden' : 'visible' }}
              onClick={() => setStap((s) => Math.max(0, s - 1))}
            >
              ← Vorige
            </button>
            <button type="button" className="btn-primary px-4 py-2" onClick={() => setStap((s) => Math.min(AANTAL_STAPPEN - 1, s + 1))}>
              Volgende →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
