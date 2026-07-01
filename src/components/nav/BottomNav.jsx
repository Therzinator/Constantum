import { useLayoutEffect, useRef } from 'react';
import { isCoordinatorOfAdmin } from '../../lib/rollen.js';
import {
  IconDashboardGevuld,
  IconMeldingGevuld,
  IconTijdlijnGevuld,
  IconGroepenGevuld,
  IconExportGevuld,
  IconModeratieGevuld
} from '../ui/GevuldeIconen.jsx';
import './BottomNav.css';

const TABS = [
  ['dashboard', '📊', 'Dashboard'],
  ['melding', '📝', 'Melding'],
  ['tijdlijn', '🕐', 'Tijdlijn'],
  ['groepen', '👥', 'Groepen'],
  ['export', '💾', 'Export']
];

// Experiment (2026-07-01): gevulde SVG-iconen i.p.v. de eerdere
// lijn-iconen (src/assets/ui-icons/*.png via mask-image) — zie
// NavIconenGevuld.jsx. fill="currentColor" volgt dezelfde
// actief/inactief-kleurlogica als de tekstlabel (.bottom-nav-tab(.actief)
// in BottomNav.css).
const ICONEN = {
  dashboard: IconDashboardGevuld,
  melding: IconMeldingGevuld,
  tijdlijn: IconTijdlijnGevuld,
  groepen: IconGroepenGevuld,
  export: IconExportGevuld,
  coordinatie: IconModeratieGevuld
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
          aria-current={pagina === naam ? 'page' : undefined}
          onClick={() => onPaginaChange(naam)}
        >
          {(() => {
            const Icoon = ICONEN[naam];
            return Icoon ? (
              <Icoon className={`bottom-nav-icoon bottom-nav-icoon-img bottom-nav-icoon-${naam}`} />
            ) : (
              <span className="bottom-nav-icoon">{icoon}</span>
            );
          })()}
          {label}
        </button>
      ))}
    </nav>
  );
}
