import { useLayoutEffect, useRef, useState } from 'react';
import { berekenVoortgang } from '../../lib/meldingen/voortgang.js';
import './VoortgangBalk.css';

// UX-restant (Baymard) uit de legacy-planning: toont hoe volledig het
// meldingformulier is ingevuld, los van de harde validatie (type + omschrijving
// blijven de enige verplichte velden — zie useNieuweMeldingForm.js::submit).
// Rood = nog in te vullen, groen = al ingevuld — zowel als balk (verhouding)
// als losse stappen (welke specifiek), zodat de melder in één oogopslag ziet
// wat er al staat en wat er nog mist. Elke stap is aanklikbaar en springt
// naar het bijbehorende formulieronderdeel (zie onStapKlik in MeldingForm.jsx).
//
// position: fixed (zie VoortgangBalk.css) i.p.v. sticky — blijft daardoor
// gegarandeerd boven de rest van de Melding-pagina staan. Omdat fixed de
// balk uit de normale layout-flow haalt, reserveert een spacer-div er
// direct onder de weggevallen ruimte, met een hoogte die meeschaalt zodra
// de stappen-rij wrapt (smal scherm, lang label, etc.) via ResizeObserver.
export function VoortgangBalk({ veld, onStapKlik }) {
  const { stappen, percentage } = berekenVoortgang(veld);
  const balkRef = useRef(null);
  const [hoogte, setHoogte] = useState(0);

  useLayoutEffect(() => {
    const el = balkRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHoogte(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="voortgang-balk-wrap" ref={balkRef}>
        <div className="voortgang-balk-track">
          <div className="voortgang-balk-fill" style={{ width: `${percentage}%` }} />
        </div>
        <div className="voortgang-balk-tekst">
          <span>Dossier volledigheid: {percentage}%</span>
        </div>
        <div className="voortgang-stappen">
          {stappen.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`voortgang-stap ${s.klaar ? 'voortgang-stap-klaar' : 'voortgang-stap-open'}`}
              onClick={() => onStapKlik?.(s.key)}
            >
              {s.klaar ? '✓' : '○'} {s.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: hoogte }} aria-hidden="true" />
    </>
  );
}
