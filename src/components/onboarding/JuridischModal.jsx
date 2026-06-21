import { useEffect } from 'react';
import './JuridischModal.css';

// Gedeelde chrome voor PrivacyVerklaringModal en AlgemeneVoorwaardenModal —
// beide zijn een scrollbare, louter informatieve juridische tekst zonder
// verplichte acceptatie, met identieke overlay/sluitknop/footer-opmaak.
export function JuridischModal({ titel, versie, laatstGewijzigd, children, onSluiten }) {
  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onSluiten(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onSluiten]);

  return (
    <div className="juridisch-modal-overlay" onClick={onSluiten}>
      <div
        className="juridisch-modal"
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="juridisch-modal-header">
          <div className="juridisch-modal-titel">{titel}</div>
          <button type="button" className="juridisch-modal-close" onClick={onSluiten} aria-label="Sluiten">×</button>
        </div>

        <div className="juridisch-modal-body">{children}</div>

        <div className="juridisch-modal-footer">
          <span>Versie {versie}</span>
          <span>Laatst gewijzigd: {laatstGewijzigd}</span>
        </div>
      </div>
    </div>
  );
}
