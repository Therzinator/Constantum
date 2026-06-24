import { useState } from 'react';
import './Collapsible.css';

// Herbruikbare inklapbare sectie — vervangt permanent-uitgeklapte stapels
// kaarten op dichte pagina's (Coördinatie, Instellingen, Groepen) door
// progressive disclosure. Children worden alleen gemount als de sectie
// open is (niet enkel display:none), zodat een zwaar onderdeel erin
// (bv. BuurtgebiedTekenaar met OpenLayers) pas laadt bij het openen.
export function Collapsible({ icoon, titel, badge, defaultOpen = false, kleur, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card collapsible">
      <button
        type="button"
        className="collapsible-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={kleur ? { color: kleur } : undefined}
      >
        <span className="collapsible-titel">
          {icoon && <span className="collapsible-icoon">{icoon}</span>}
          {titel}
        </span>
        <span className="collapsible-rechts">
          {badge != null && badge !== '' && <span className="badge badge-muted collapsible-badge">{badge}</span>}
          <span className={`collapsible-chevron ${open ? 'collapsible-chevron-open' : ''}`}>▾</span>
        </span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
