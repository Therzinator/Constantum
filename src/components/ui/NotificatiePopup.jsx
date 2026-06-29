import { useState } from 'react';
import notifIcon from '../../assets/ui-icons/interface_notification.png';
import './NotificatiePopup.css';

export function NotificatiePopup({ aantalOngelezen, groepActiviteit, markeerAlsGezien, onNavigeerGroep }) {
  const [open, setOpen] = useState(false);

  if (!aantalOngelezen) return null;

  const sluit = () => {
    markeerAlsGezien();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="notif-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${aantalOngelezen} nieuwe meldingen in uw groepen`}
      >
        <img src={notifIcon} alt="" className="notif-fab-icoon" />
        <span className="notif-badge">{aantalOngelezen > 9 ? '9+' : aantalOngelezen}</span>
      </button>

      {open && (
        <>
          <div className="notif-overlay" onClick={sluit} aria-hidden="true" />
          <div className="notif-panel" role="dialog" aria-label="Nieuwe activiteit">
            <div className="notif-panel-header">
              <span className="notif-panel-titel">Nieuwe activiteit</span>
              <button type="button" className="notif-sluit" onClick={sluit} aria-label="Sluiten">✕</button>
            </div>

            <div className="notif-panel-inhoud">
              {groepActiviteit.length === 0 ? (
                <div className="notif-leeg">Geen nieuwe activiteit.</div>
              ) : (
                groepActiviteit.map((item) => (
                  <button
                    key={item.groepId}
                    type="button"
                    className="notif-item"
                    onClick={() => { onNavigeerGroep(item.groepId); sluit(); }}
                  >
                    <div className="notif-item-tekst">
                      <strong className="notif-item-groepnaam">{item.groepNaam}</strong>
                      <span className="notif-item-sub">
                        {item.aantalNieuw} nieuwe {item.aantalNieuw === 1 ? 'melding' : 'meldingen'}
                      </span>
                    </div>
                    <span className="notif-item-pijl">›</span>
                  </button>
                ))
              )}
            </div>

            <button type="button" className="notif-markeer-knop" onClick={sluit}>
              Alles als gelezen markeren
            </button>
          </div>
        </>
      )}
    </>
  );
}
