import { useLayoutEffect, useRef } from 'react';
import { isCoordinatorOfAdmin } from '../../lib/rollen.js';
import dashboardIcon from '../../assets/ui-icons/icon_dashboard.png';
import meldingIcon from '../../assets/ui-icons/icon_melding.png';
import tijdlijnIcon from '../../assets/ui-icons/icon_tijdlijn.png';
import moderatieIcon from '../../assets/ui-icons/icon_moderatie.png';
import exportIcon from '../../assets/ui-icons/icon_export.png';
import groepenIcon from '../../assets/ui-icons/icon_groepen.png';
import './BottomNav.css';

const TABS = [
  ['dashboard', '📊', 'Dashboard'],
  ['melding', '📝', 'Melding'],
  ['tijdlijn', '🕐', 'Tijdlijn'],
  ['groepen', '👥', 'Groepen'],
  ['export', '💾', 'Export']
];

// Alle tabs hebben een uitgesneden lijn-icoon (src/assets/ui-icons/) — als
// currentColor-mask zodat actief/inactief dezelfde kleurlogica volgt als de
// tekstlabel (.bottom-nav-tab(.actief) in BottomNav.css).
const ICONEN = {
  dashboard: dashboardIcon,
  melding: meldingIcon,
  tijdlijn: tijdlijnIcon,
  groepen: groepenIcon,
  export: exportIcon,
  coordinatie: moderatieIcon
};

// Komt overeen met de bottom-tab-navigatie uit docs/index.html
// (showPage/tab-dashboard/tab-melding/tab-tijdlijn/tab-export/
// tab-instellingen, Fase G), aangevuld met de Groepenfunctie (vervangt de
// vroegere header-knop "Uitnodigen", zie AppHeader.jsx/DECISIONS.md).
// "Moderatie" (pagina-key blijft 'coordinatie', Fase 4) is zichtbaar voor
// admins én coordinators (moderator-achtige rol, sinds migratie 0011) — de
// echte afscherming gebeurt via RLS, dit is puur UI. "Instellingen" staat
// hier bewust NIET meer in — alleen nog te openen via het account-menu in
// de header (AccountMenu.jsx), zie App.jsx.
export function BottomNav({ pagina, onPaginaChange, gebruikerRol }) {
  const tabs = isCoordinatorOfAdmin(gebruikerRol) ? [...TABS, ['coordinatie', '🛡️', 'Moderatie']] : TABS;
  const navRef = useRef(null);

  // Schrijft de eigen, werkelijke hoogte naar --nav-hoogte (CSS-variabele,
  // zie styles/theme.css) — nodig sinds de nav `position: fixed` is
  // (losgekoppeld van de documentflow, zie BottomNav.css): de pagina-
  // inhoud (.app-inhoud, index.css) gebruikt deze variabele als
  // bottom-padding zodat de laatste content nooit achter de nav verdwijnt,
  // ook niet als de nav-hoogte ooit verandert (labels/zoom/extra tab).
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const zetHoogte = () => {
      document.documentElement.style.setProperty('--nav-hoogte', `${el.getBoundingClientRect().height}px`);
    };
    const observer = new ResizeObserver(zetHoogte);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="bottom-nav" ref={navRef}>
      {tabs.map(([naam, icoon, label]) => (
        <button
          key={naam}
          type="button"
          className={`bottom-nav-tab ${pagina === naam ? 'actief' : ''}`}
          onClick={() => onPaginaChange(naam)}
        >
          {ICONEN[naam] ? (
            <span
              className="bottom-nav-icoon bottom-nav-icoon-img"
              style={{ WebkitMaskImage: `url(${ICONEN[naam]})`, maskImage: `url(${ICONEN[naam]})` }}
            />
          ) : (
            <span className="bottom-nav-icoon">{icoon}</span>
          )}
          {label}
        </button>
      ))}
    </nav>
  );
}
