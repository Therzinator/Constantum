import { useEffect, useRef, useState } from 'react';
import { DeeltokenGenerator } from './DeeltokenGenerator.jsx';
import groepenIcon from '../../assets/ui-icons/groepen.png';
import './UitnodigenMenu.css';

// Dropdown-paneel i.p.v. eigen pagina (voorheen UitnodigenPage.jsx) — zelfde
// patroon als AccountMenu.jsx (Instellingen): de knop in AppHeader.jsx opent
// een los paneel met de uitnodigingsfunctie, in plaats van naar een aparte
// route te navigeren.
export function UitnodigenMenu({ user, thuislocatie }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    const handleEscape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="uitnodigen-menu" ref={menuRef}>
      <button
        type="button"
        className="app-header-uitnodigen-knop"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Buren uitnodigen"
        aria-label="Buren uitnodigen"
      >
        <span
          className="app-header-knop-icoon-img"
          style={{ WebkitMaskImage: `url(${groepenIcon})`, maskImage: `url(${groepenIcon})` }}
        />
        <span className="app-header-knop-label">Uitnodigen</span>
      </button>

      {open && (
        <div className="uitnodigen-menu-paneel" role="menu">
          <DeeltokenGenerator user={user} thuislocatie={thuislocatie} />
        </div>
      )}
    </div>
  );
}
