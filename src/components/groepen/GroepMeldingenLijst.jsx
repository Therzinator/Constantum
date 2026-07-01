import { lazy, Suspense, useMemo, useState } from 'react';
import { verwijderMeldingUitGroep } from '../../lib/groepen/groepen.js';
import { clusterMeldingen } from '../../lib/meldingen/clustering.js';
import { useGroepMeldingen } from '../../hooks/useGroepMeldingen.js';
import { GroepMeldingKaart } from './GroepMeldingKaart.jsx';
import { GroepClusterKaart } from './GroepClusterKaart.jsx';
import { GroepMeldingDetailModal } from './GroepMeldingDetailModal.jsx';
import '../meldingen/MeldingCard.css';
import '../meldingen/TijdlijnPage.css';
import './GroepMeldingenLijst.css';

// Lazy — trekt OpenLayers (~300-400KB) mee, dat hoort niet in de
// hoofdbundel voor gebruikers die nooit een groep met kaart bekijken
// (zelfde reden als DashboardKaart.jsx/LocatieKaart.jsx hierboven).
const GroepDashboardKaart = lazy(() => import('./GroepDashboardKaart.jsx').then((m) => ({ default: m.GroepDashboardKaart })));

const NIVEAU_LABEL = { laag: 'Laag', gemiddeld: 'Gemiddeld', hoog: 'Hoog' };
const RECENT_AANTAL = 5;

// Sectie 1/5 — meldingen binnen een groep, in dezelfde kaart-vorm als
// "Recente meldingen" (Dashboard, MeldingCard.jsx compacte variant) i.p.v.
// een platte tekstlijst. Hoeveel detail elke kaart toont hangt af van de
// trust score van de KIJKER (niet de melder) — de toegangs-gate (is de
// melding wel met deze groep gedeeld) is al RLS-niveau (migratie 0015);
// hier wordt alleen bepaald welke VELDEN getoond worden, via
// src/lib/groepen/trustZichtbaarheid.js (config-gebaseerd, zodat nieuwe
// niveaus later makkelijk toevoegbaar zijn). Data-/redactielogica zit in
// hooks/useGroepMeldingen.js, gedeeld met DashboardPage.jsx se
// groepsfilter (die zijn eigen kaart toont via DashboardKaart.jsx, zie
// `toonKaart`).
//
// Twee weergaven, zelfde onderscheid als Dashboard ("Recente meldingen")
// vs. de persoonlijke Tijdlijn-pagina: "Recent" toont de 5 laatste losse
// meldingen, "Tijdlijn" toont alle meldingen gegroepeerd tot gebeurtenissen
// (clusterMeldingen(), zelfde perceel/locatie + tijdvenster van 8u als de
// persoonlijke Tijdlijn) via GroepClusterKaart.jsx.
export function GroepMeldingenLijst({ groepId, viewerTrustScore, viewerUserId, user, isBeheerder, toonKaart = true }) {
  const { meldingen: veilig, toon, niveau, laden, fout, verwijderLokaal } = useGroepMeldingen(groepId, { viewerTrustScore, isBeheerder });
  const [geopend, setGeopend] = useState(null);
  const [verwijderenId, setVerwijderenId] = useState(null);
  const [modus, setModus] = useState('recent');

  const handleVerwijder = async (meldingId) => {
    if (!confirm('Deze melding uit de groep verwijderen?')) return;
    setVerwijderenId(meldingId);
    try {
      await verwijderMeldingUitGroep(groepId, meldingId);
      verwijderLokaal(meldingId);
    } catch (err) {
      alert(`Verwijderen mislukt: ${err.message}`);
    } finally {
      setVerwijderenId(null);
    }
  };

  const recent = useMemo(() => veilig.slice(0, RECENT_AANTAL), [veilig]);
  const clusters = useMemo(() => (modus === 'tijdlijn' ? clusterMeldingen(veilig) : null), [modus, veilig]);

  if (fout) return <div className="export-card-beschrijving" style={{ color: 'var(--danger)' }}>Meldingen laden mislukt: {fout}</div>;
  if (laden) return <div className="export-card-beschrijving">Meldingen laden...</div>;
  if (veilig.length === 0) return <div className="export-card-beschrijving">Nog geen meldingen gedeeld met deze groep.</div>;

  return (
    <div>
      <div className="export-card-beschrijving mb-2">
        {isBeheerder
          ? 'Als beheerder heb je volledige inzage in gedeelde meldingen.'
          : <>Jouw zichtbaarheidsniveau in deze groep: <strong>{NIVEAU_LABEL[niveau] || niveau}</strong>, gebaseerd op je eigen trust score.</>}
      </div>

      {toonKaart && (
        <div className="mb-2">
          <Suspense fallback={<div className="export-card-beschrijving">Kaart laden...</div>}>
            <GroepDashboardKaart meldingen={veilig} onMeldingSelecteren={setGeopend} />
          </Suspense>
        </div>
      )}

      <div className="groepen-meldingen-modus">
        <button type="button" className={`tijdlijn-modus-btn ${modus === 'recent' ? 'actief' : ''}`} onClick={() => setModus('recent')}>
          📋 Recente meldingen
        </button>
        <button type="button" className={`tijdlijn-modus-btn ${modus === 'tijdlijn' ? 'actief' : ''}`} onClick={() => setModus('tijdlijn')}>
          🔗 Tijdlijn
        </button>
      </div>

      {modus === 'recent' ? (
        recent.map((m) => (
          <GroepMeldingKaart
            key={m.id}
            melding={m}
            toon={toon}
            viewerUserId={viewerUserId}
            isBeheerder={isBeheerder}
            verwijderenId={verwijderenId}
            onVerwijder={handleVerwijder}
            onOpen={setGeopend}
          />
        ))
      ) : (
        clusters.map((cluster) => (
          <GroepClusterKaart
            key={cluster.id}
            cluster={cluster}
            toon={toon}
            viewerUserId={viewerUserId}
            isBeheerder={isBeheerder}
            verwijderenId={verwijderenId}
            onVerwijder={handleVerwijder}
            onOpen={setGeopend}
          />
        ))
      )}

      {geopend && (
        <GroepMeldingDetailModal
          melding={geopend}
          toon={toon}
          isEigen={geopend.user_id && geopend.user_id === viewerUserId}
          user={user}
          onClose={() => setGeopend(null)}
        />
      )}
    </div>
  );
}
