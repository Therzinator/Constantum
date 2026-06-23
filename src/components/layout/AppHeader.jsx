import { useLayoutEffect, useRef } from 'react';
import { AccountMenu } from './AccountMenu.jsx';
import { UitnodigenMenu } from '../notificaties/UitnodigenMenu.jsx';
import './AppHeader.css';

// Vaste headerbalk met het SpuitLogger-logo — de app had voorheen helemaal
// geen header (zie ook OnlineIndicator.jsx), waardoor er nergens merk-
// herkenning was en losse paginatitels (bv. ExportPage) zonder omlijnende
// kaart op de onderliggende paginakleur bleven staan.
//
// Schrijft de eigen, werkelijke hoogte naar --header-hoogte (CSS-variabele,
// zie styles/theme.css) zodat andere vast-gepositioneerde elementen (bv.
// VoortgangBalk.jsx) er exact — zonder gat of overlap — onder kunnen
// aansluiten, ook als de header-hoogte ooit verandert (logo/font/zoom).
export function AppHeader({ user, onNavigeerInstellingen, thuislocatie, syncNu, syncBezig, laadVanCloud, onUitloggen }) {
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // getBoundingClientRect (fractioneel) i.p.v. offsetHeight (geheel
    // getal) — anders blijft er door afronding een sub-pixel gaatje over
    // tussen header en de elementen die er vlak onder aansluiten.
    const zetHoogte = () => {
      document.documentElement.style.setProperty('--header-hoogte', `${el.getBoundingClientRect().height}px`);
    };
    const observer = new ResizeObserver(zetHoogte);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="app-header" ref={headerRef}>
      <img src="/icons/header-logo.png" alt="SpuitLogger" className="app-header-logo" />
      <div className="app-header-tekst">
        <span className="app-header-titel">SpuitLogger</span>
        <span className="app-header-subtitel">Spuitactiviteiten Dossier</span>
      </div>
      <div className="app-header-acties">
        <UitnodigenMenu user={user} thuislocatie={thuislocatie} />
        <AccountMenu
          user={user}
          onNavigeerInstellingen={onNavigeerInstellingen}
          syncNu={syncNu}
          syncBezig={syncBezig}
          laadVanCloud={laadVanCloud}
          onUitloggen={onUitloggen}
        />
      </div>
    </header>
  );
}
