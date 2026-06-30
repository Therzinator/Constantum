import { forwardRef, useEffect, useRef, useState } from 'react';
import './CheckboxDropdown.css';

// Komt overeen met de dropdown-checkbox-panelen uit docs/index.html
// (toggleDriftDropdown/toggleActiviteitDropdown/toggleGezondheid e.d.):
// een knop met samenvatting die, ingeklapt, een paneel met checkboxes toont.
export const CheckboxDropdown = forwardRef(function CheckboxDropdown(
  { label, opties, geselecteerd, onToggle, placeholder = 'Niets geselecteerd', fout, labelMap, onClose },
  ref
) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const samenvatting = geselecteerd.length
    ? geselecteerd.map((w) => (labelMap ? labelMap[w] : opties.find(([v]) => v === w)?.[1]) || w).join(' · ')
    : placeholder;

  // Sluiten van de dropdown geldt als "veld verlaten" — Baymard-richtlijn:
  // valideer zodra een gebruiker een veld verlaat, niet pas bij submit.
  const handleToggle = () => {
    setOpen((huidig) => {
      if (huidig) onClose?.();
      return !huidig;
    });
  };

  return (
    <div className="cd-field" ref={containerRef}>
      <label className="section-label">{label}</label>
      <button
        ref={ref}
        type="button"
        className={`cd-trigger ${fout ? 'cd-trigger-fout' : ''}`}
        onClick={handleToggle}
      >
        <span style={{ color: geselecteerd.length ? 'var(--text-primary)' : 'var(--text-muted)' }}>{samenvatting}</span>
        <span className="cd-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cd-panel">
          {opties.map(([waarde, optieLabel]) => (
            <label key={waarde} className="cd-checkbox-label">
              <input
                type="checkbox"
                checked={geselecteerd.includes(waarde)}
                onChange={() => onToggle(waarde)}
              />
              {optieLabel}
            </label>
          ))}
        </div>
      )}
    </div>
  );
});
