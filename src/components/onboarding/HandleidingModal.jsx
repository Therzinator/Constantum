import { useEffect, useState } from 'react';
import { markeerHandleidingGezien } from '../../lib/onboarding/handleidingStatus.js';
import { PrivacyVerklaringModal } from './PrivacyVerklaringModal.jsx';
import './HandleidingModal.css';

const AANTAL_STAPPEN = 6;

// Welkomst-/handleiding-wizard. Verschijnt automatisch bij de eerste keer
// dat de app wordt gebruikt (zie App.jsx, gate op handleidingStatus.js) en
// is via Instellingen → "Over Constatum" altijd opnieuw te openen.
export function HandleidingModal({ onSluiten }) {
  const [stap, setStap] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const sluiten = () => {
    markeerHandleidingGezien();
    onSluiten();
  };

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') sluiten(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sluiten is stabiel genoeg (geen externe deps), enige escape-listener bij mount
  }, []);

  if (privacyOpen) {
    return <PrivacyVerklaringModal onSluiten={() => setPrivacyOpen(false)} />;
  }

  return (
    <div className="handleiding-overlay" onClick={sluiten}>
      <div
        className="handleiding-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Welkom bij Constatum"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="handleiding-close" onClick={sluiten} aria-label="Sluiten">×</button>

        {stap === 0 && (
          <>
            <div className="handleiding-icoon">🌿</div>
            <div className="handleiding-titel">Welkom bij Constatum</div>
            <div className="handleiding-tekst">
              {`Constatum is een app waarmee je omgevingsmeldingen vastlegt — bijvoorbeeld spuitactiviteit, drift, geur, geluid of gezondheidsklachten. De app helpt je om dat moment goed te documenteren, zodat je er later iets mee kunt: een dossier opbouwen, delen met buren, of gebruiken als onderbouwing richting derden.

Constatum is geen overheidsinstrument en handhaaft niet. De app registreert wat jij waarneemt; wat je daarmee doet, bepaal je zelf.`}
            </div>
          </>
        )}

        {stap === 1 && (
          <>
            <div className="handleiding-titel">Een melding vastleggen</div>
            <div className="handleiding-grid">
              <div className="handleiding-grid-item">
                <div className="handleiding-grid-icoon">📍</div>
                <div className="handleiding-grid-label">Kies een type en zet de pin op de locatie. Het kadastrale perceel is zichtbaar zodat je kunt zien om welk perceel het gaat.</div>
              </div>
              <div className="handleiding-grid-item">
                <div className="handleiding-grid-icoon">🌤️</div>
                <div className="handleiding-grid-label">Actuele windrichting en -snelheid worden automatisch opgehaald en getoetst aan de geldende spuitrichtlijn.</div>
              </div>
              <div className="handleiding-grid-item">
                <div className="handleiding-grid-icoon">📸</div>
                <div className="handleiding-grid-label">Voeg foto's of video toe. Locatiegegevens worden verwijderd; van het origineel wordt een hash berekend.</div>
              </div>
              <div className="handleiding-grid-item">
                <div className="handleiding-grid-icoon">✅</div>
                <div className="handleiding-grid-label">Sla op. Vanaf dat moment staat er een tijdstempel op die niet meer aan te passen is.</div>
              </div>
            </div>
          </>
        )}

        {stap === 2 && (
          <>
            <div className="handleiding-titel">Je dossier</div>
            <div className="handleiding-tekst">
              {`Al je meldingen staan op de tijdlijn, met filter op type, datum of gebied. Je kunt op elk moment een selectie exporteren als PDF-dossier, inclusief kaartweergave en weergegevens. Het dossier bevat een tijdstempel en een digitale hash, zodat de inhoud achteraf niet ongemerkt kan worden aangepast.

Voor situaties waarin je wilt weten welk middel er precies is gespoten, kun je vanuit een melding met bekend perceel een kant-en-klare brief genereren om inzage in het spuitregister op te vragen bij de teler.`}
            </div>
          </>
        )}

        {stap === 3 && (
          <>
            <div className="handleiding-titel">Delen met anderen</div>
            <div className="handleiding-tekst">
              {`Delen is altijd je eigen keuze — een melding is standaard alleen voor jou zichtbaar.

• Buurt: je kunt aangeven dat een melding zichtbaar mag zijn voor mensen binnen 5 km van hun eigen locatie. Anderen zien dan nooit je naam of e-mailadres, alleen een vaste, anonieme code (Melder#XXXXXX).

• Groepen: je kunt je aansluiten bij of een groep aanmaken (via link of QR-code) en per melding kiezen of je die met die groep deelt. Hoeveel detail andere groepsleden zien hangt af van hun eigen betrouwbaarheidsniveau binnen de app.`}
            </div>
          </>
        )}

        {stap === 4 && (
          <>
            <div className="handleiding-titel">Privacy</div>
            <div className="handleiding-tekst">
              {`• Je gegevens zijn standaard alleen voor jezelf zichtbaar.
• Bij delen zie je nooit iemands echte naam of e-mailadres, alleen een anonieme code.
• Je kunt instellen of er kwetsbare personen (zoals kinderen) in je huishouden aanwezig zijn. Dit is optioneel, vereist een aparte toestemming, en de details blijven bij je eigen profiel.
• Je kunt je uitsluiten van het gebruik van je (geanonimiseerde) data voor algemeen onderzoek, via Instellingen.`}
            </div>
            <button type="button" className="handleiding-link-knop" onClick={() => setPrivacyOpen(true)}>
              Lees de volledige privacyverklaring →
            </button>
          </>
        )}

        {stap === 5 && (
          <>
            <div className="handleiding-titel">Vragen of problemen</div>
            <div className="handleiding-tekst">
              Klopt er iets niet, of heb je een vraag over een melding of export?
              Neem contact op via de contactgegevens in de app onder Instellingen.
            </div>
            <button type="button" className="btn-primary handleiding-cta" onClick={sluiten}>
              Aan de slag →
            </button>
            <div className="handleiding-replay-link">Handleiding later opnieuw bekijken via het accountmenu (tandwiel rechtsboven)</div>
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
