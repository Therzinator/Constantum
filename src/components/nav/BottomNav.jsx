import { isCoordinatorOfAdmin } from '../../lib/rollen.js';
import dashboardIcon from '../../assets/ui-icons/dashboard.png';
import meldingIcon from '../../assets/ui-icons/melding.png';
import tijdlijnIcon from '../../assets/ui-icons/tijdlijn.png';
import moderatieIcon from '../../assets/ui-icons/moderatie.png';
import exportIcon from '../../assets/ui-icons/export.png';
import './BottomNav.css';

const TABS = [
  ['dashboard', '📊', 'Dashboard'],
  ['melding', '📝', 'Melding'],
  ['tijdlijn', '🕐', 'Tijdlijn'],
  ['export', '💾', 'Export']
];

// Alle tabs hebben een uitgesneden lijn-icoon (src/assets/ui-icons/) — als
// currentColor-mask zodat actief/inactief dezelfde kleurlogica volgt als de
// tekstlabel (.bottom-nav-tab(.actief) in BottomNav.css).
const ICONEN = {
  dashboard: dashboardIcon,
  melding: meldingIcon,
  tijdlijn: tijdlijnIcon,
  export: exportIcon,
  coordinatie: moderatieIcon
};

// Komt overeen met de bottom-tab-navigatie uit docs/index.html
// (showPage/tab-dashboard/tab-melding/tab-tijdlijn/tab-export/
// tab-instellingen, Fase G). "Moderatie" (pagina-key blijft 'coordinatie',
// Fase 4) is zichtbaar voor admins én coordinators (moderator-achtige rol,
// sinds migratie 0011) — de echte afscherming gebeurt via RLS, dit is puur
// UI. "Instellingen" staat hier bewust NIET meer in — alleen nog te openen
// via het account-menu in de header (AccountMenu.jsx), zie App.jsx.
export function BottomNav({ pagina, onPaginaChange, gebruikerRol }) {
  const tabs = isCoordinatorOfAdmin(gebruikerRol) ? [...TABS, ['coordinatie', '🛡️', 'Moderatie']] : TABS;
  return (
    <nav className="bottom-nav">
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
