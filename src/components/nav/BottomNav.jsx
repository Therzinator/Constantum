import './BottomNav.css';

const TABS = [
  ['dashboard', '📊', 'Dashboard'],
  ['melding', '📝', 'Melding'],
  ['tijdlijn', '🕐', 'Tijdlijn'],
  ['export', '💾', 'Export']
];

// Komt overeen met de bottom-tab-navigatie uit docs/index.html
// (showPage/tab-dashboard/tab-melding/tab-tijdlijn/tab-export). Instellingen
// volgt als eigen tab in een latere fase.
export function BottomNav({ pagina, onPaginaChange }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(([naam, icoon, label]) => (
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
