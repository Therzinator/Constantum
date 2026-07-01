// Gevulde (solid/filled) iconen, als vervanging van de eerdere lijn-
// iconen (src/assets/ui-icons/*.png, via mask-image) — experiment
// 2026-07-01, ondertussen doorgevoerd op BottomNav.jsx, AccountMenu.jsx
// (Instellingen) en DeelAppKnop.jsx (Delen). Inline SVG i.p.v. PNG-mask —
// fill="currentColor" volgt dezelfde actief/inactief-kleurlogica als de
// omliggende tekst, zonder losse beeldbestanden. "Uitgesneden" details
// (plusje/vinkje/tandwielgat) gebruiken de vaste kaartachtergrond
// (--bg-card) i.p.v. currentColor, zodat ze zowel in actieve (accent) als
// inactieve (grijze) staat zichtbaar blijven.
const svgProps = { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' };

export function IconDashboardGevuld(props) {
  return (
    <svg {...svgProps} {...props}>
      <rect x="3" y="13" width="4.5" height="8" rx="1.2" fill="currentColor" />
      <rect x="9.75" y="8" width="4.5" height="13" rx="1.2" fill="currentColor" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconMeldingGevuld(props) {
  return (
    <svg {...svgProps} {...props}>
      <path
        fill="currentColor"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      />
      <circle cx="12" cy="9" r="2.6" fill="var(--bg-card)" />
    </svg>
  );
}

export function IconTijdlijnGevuld(props) {
  return (
    <svg {...svgProps} {...props}>
      <rect x="4.3" y="5.2" width="1.6" height="13.6" rx="0.8" fill="currentColor" />
      <circle cx="5.1" cy="6" r="2.4" fill="currentColor" />
      <circle cx="5.1" cy="12" r="2.4" fill="currentColor" />
      <circle cx="5.1" cy="18" r="2.4" fill="currentColor" />
      <rect x="10" y="5" width="11" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="10" y="10.9" width="11" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="10" y="16.8" width="11" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  );
}

export function IconGroepenGevuld(props) {
  return (
    <svg {...svgProps} {...props}>
      <circle cx="4.6" cy="9.3" r="2.3" fill="currentColor" opacity="0.85" />
      <path d="M4.6 12.4c-2.6 0-4.6 1.6-4.6 3.9v1.4h6.4v-2c0-1.2.4-2.3 1.1-3.1-.9-.14-1.9-.2-2.9-.2z" fill="currentColor" opacity="0.85" />
      <circle cx="19.4" cy="9.3" r="2.3" fill="currentColor" opacity="0.85" />
      <path d="M19.4 12.4c2.6 0 4.6 1.6 4.6 3.9v1.4h-6.4v-2c0-1.2-.4-2.3-1.1-3.1.9-.14 1.9-.2 2.9-.2z" fill="currentColor" opacity="0.85" />
      <circle cx="12" cy="8" r="3.3" fill="currentColor" />
      <path d="M12 12.6c-4.1 0-7.2 2.3-7.2 5.6v1.4h14.4v-1.4c0-3.3-3.1-5.6-7.2-5.6z" fill="currentColor" />
    </svg>
  );
}

export function IconExportGevuld(props) {
  return (
    <svg {...svgProps} {...props}>
      <path fill="currentColor" d="M12 2.5v11.3l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6V2.5z" />
      <rect x="3.5" y="18.5" width="17" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconModeratieGevuld(props) {
  return (
    <svg {...svgProps} {...props}>
      <path fill="currentColor" d="M12 2 4.5 5v6c0 5.25 3.4 9.9 7.5 11 4.1-1.1 7.5-5.75 7.5-11V5L12 2z" />
      <path
        fill="none"
        stroke="var(--bg-card)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.3 12.2l2.5 2.5 5-5"
      />
    </svg>
  );
}

// Tandwiel opgebouwd uit 8 rondom het middelpunt geroteerde "tanden" +
// een gevulde cirkel als lichaam — betrouwbaarder dan een handgetekend
// tandwiel-pad met veel bezier-punten uit het hoofd reconstrueren.
const TAND_HOEKEN = [0, 45, 90, 135, 180, 225, 270, 315];

export function IconInstellingenGevuld(props) {
  return (
    <svg {...svgProps} {...props}>
      {TAND_HOEKEN.map((hoek) => (
        <rect key={hoek} x="10.5" y="0.8" width="3" height="5" rx="1" fill="currentColor" transform={`rotate(${hoek} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="7" fill="currentColor" />
      <circle cx="12" cy="12" r="3" fill="var(--bg-card)" />
    </svg>
  );
}

// Klassiek "delen"-icoon (drie knooppunten + twee verbindingslijnen) —
// bewust een andere vorm dan IconExportGevuld (pijl-in-tray), zodat
// "Delen" (systeemdeelkeuze/klembord, DeelAppKnop.jsx) niet verward
// wordt met "Export" (dossier downloaden, BottomNav).
export function IconDelenGevuld(props) {
  return (
    <svg {...svgProps} {...props}>
      <line x1="6.5" y1="12" x2="17" y2="6.2" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      <line x1="6.5" y1="12" x2="17" y2="17.8" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="5" cy="12" r="3" fill="currentColor" />
      <circle cx="18.5" cy="5.5" r="3" fill="currentColor" />
      <circle cx="18.5" cy="18.5" r="3" fill="currentColor" />
    </svg>
  );
}
