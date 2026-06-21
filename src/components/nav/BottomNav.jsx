import { isCoordinatorOfAdmin } from '../../lib/rollen.js';
import './BottomNav.css';

const TABS = [
  ['dashboard', '📊', 'Dashboard'],
  ['melding', '📝', 'Melding'],
  ['tijdlijn', '🕐', 'Tijdlijn'],
  ['export', '💾', 'Export'],
  ['instellingen', '⚙️', 'Instellingen']
];

// Komt overeen met de bottom-tab-navigatie uit docs/index.html
// (showPage/tab-dashboard/tab-melding/tab-tijdlijn/tab-export/
// tab-instellingen, Fase G). "Coördinatie" (Fase 4) is zichtbaar voor
// admins én coordinators (moderator-achtige rol, sinds migratie 0011) —
// de echte afscherming gebeurt via RLS, dit is puur UI.
export function BottomNav({ pagina, onPaginaChange, gebruikerRol }) {
  const tabs = isCoordinatorOfAdmin(gebruikerRol) ? [...TABS, ['coordinatie', '🛡️', 'Coördinatie']] : TABS;
  return (
    <nav className="bottom-nav">
      {tabs.map(([naam, icoon, label]) => (
        <button
          key={naam}
          type="button"
          className={`bottom-nav-tab ${pagina === naam ? 'actief' : ''}`}
          onClick={() => onPaginaChange(naam)}
        >
          <span className="bottom-nav-icoon">{icoon}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
