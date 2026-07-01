import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { MaandGrafiek } from './MaandGrafiek.jsx';
import { MeldingCard } from '../meldingen/MeldingCard.jsx';
import { GroepMeldingenLijst } from '../groepen/GroepMeldingenLijst.jsx';
import { GroepMeldingDetailModal } from '../groepen/GroepMeldingDetailModal.jsx';
import { dashboardStatistieken } from '../../lib/meldingen/statistieken.js';
import { laadGpsCache } from '../../lib/geo/gpsCache.js';
import { laadBereikMeter } from '../../lib/notificaties/buurtMelding.js';
import { haversineAfstand } from '../../lib/geo/haversine.js';
import { magAndermansMeldingTonen } from '../../lib/meldingen/buurtVertraging.js';
import { haalMijnGroepen, haalGroepStatistieken } from '../../lib/groepen/groepen.js';
import { isGroepBeheerder } from '../../lib/groepen/rollen.js';
import { useGebruikersProfiel } from '../../hooks/useGebruikersProfiel.js';
import { useGroepMeldingen } from '../../hooks/useGroepMeldingen.js';
import './DashboardPage.css';

// Lazy geladen — beide trekken OpenLayers (~300-400KB) mee, dat hoeft niet
// in de hoofdbundel te zitten voor gebruikers die deze pagina niet openen.
// GroepMeldingDetailModal.jsx is bewust NIET lazy — die is zelf al licht
// (eigen DriftZoneKaart-import is daarbinnen al lazy), geen aparte
// code-splitting-winst.
const DashboardKaart = lazy(() => import('./DashboardKaart.jsx').then((m) => ({ default: m.DashboardKaart })));
const MeldingDetailModal = lazy(() => import('../melding/MeldingDetailModal.jsx').then((m) => ({ default: m.MeldingDetailModal })));

// Komt overeen met de pagina 'dashboard' (updateDashboard/renderCharts) uit
// docs/index.html: statistieken, kaart met driftlagen, maandgrafiek en de
// 5 meest recente meldingen.
export function DashboardPage({ meldingenApi, user, gebruikerRol, thuislocatie }) {
  const { meldingen } = meldingenApi;
  const [geselecteerdId, setGeselecteerdId] = useState(null);
  // Filter op een groep waar je lid van bent — de KAART (DashboardKaart)
  // blijft altijd zichtbaar en toont dan de met die groep gedeelde
  // meldingen i.p.v. eigen+buurt, i.p.v. dat de hele kaartweergave
  // verdwijnt. Groepsmeldingen van ANDERE gebruikers staan nooit in de
  // lokale meldingen-store (alleen eigen + opt-in-buurt worden gesynct,
  // zie entries.js) — vandaar een aparte fetch (useGroepMeldingen) i.p.v.
  // filteren op `meldingen`.
  const [mijnGroepen, setMijnGroepen] = useState([]);
  const [groepFilter, setGroepFilter] = useState('');
  const [groepStats, setGroepStats] = useState(null);
  const profiel = useGebruikersProfiel(user);

  useEffect(() => {
    if (!user) { setMijnGroepen([]); return; }
    let actief = true;
    haalMijnGroepen(user.id)
      .then((data) => { if (actief) setMijnGroepen(data); })
      .catch(() => { if (actief) setMijnGroepen([]); });
    return () => { actief = false; };
  }, [user]);

  useEffect(() => {
    if (!groepFilter) { setGroepStats(null); return; }
    let actief = true;
    haalGroepStatistieken(groepFilter).then((data) => { if (actief) setGroepStats(data); });
    return () => { actief = false; };
  }, [groepFilter]);

  // Voorkomt dat het filter op een groep blijft staan die niet meer in de
  // (ververste) ledenlijst voorkomt — bv. na uitloggen terwijl dit filter
  // actief was, of na het verlaten van de groep elders in de app.
  useEffect(() => {
    if (groepFilter && !mijnGroepen.some((g) => g.id === groepFilter)) {
      setGroepFilter('');
    }
  }, [mijnGroepen, groepFilter]);

  const geselecteerdeGroep = mijnGroepen.find((g) => g.id === groepFilter) || null;
  const isBeheerderVanGroep = isGroepBeheerder(geselecteerdeGroep?.eigenRol);
  const groepData = useGroepMeldingen(groepFilter, { viewerTrustScore: profiel?.trust_score, isBeheerder: isBeheerderVanGroep });

  // Zelfde bereik-instelling als Instellingen → account-menu (max 5 km, zie
  // buurtMelding.js) — dit dashboard toont gedeelde meldingen van ANDEREN
  // dus nooit verder weg dan dat ingestelde bereik. Eigen meldingen (incl.
  // nog niet gesynchroniseerde, zonder user_id) blijven altijd zichtbaar.
  // De database (migratie 0009) handhaaft daarbovenop een harde grens van
  // 5 km, onafhankelijk van deze client-instelling. Daarnaast worden
  // andermans meldingen pas 30 minuten na het melden zichtbaar
  // (magAndermansMeldingTonen, lib/meldingen/buurtVertraging.js) — dit
  // beschermt de identiteit van de melder tegen een teler die zich
  // (mogelijk onder een valse naam) bij de buurt-groep heeft aangesloten en
  // anders realtime zou kunnen zien wie net heeft gemeld.
  const radiusMeter = laadBereikMeter();
  const meldingenInBereik = useMemo(() => meldingen.filter((m) => {
    if (!m.user_id || m.user_id === user?.id) return true;
    if (!m.opt_in_buurt) return false;
    if (!magAndermansMeldingTonen(m, user)) return false;
    if (!thuislocatie?.lat || !thuislocatie?.lng || m.gps?.lat == null || m.gps?.lng == null) return false;
    return haversineAfstand(thuislocatie.lat, thuislocatie.lng, m.gps.lat, m.gps.lng) <= radiusMeter;
  }), [meldingen, user, thuislocatie, radiusMeter]);

  const { totaal, dezeMaand, dezeWeek, topWind } = dashboardStatistieken(meldingenInBereik);
  const recent = [...meldingenInBereik]
    .sort((a, b) => new Date(b.timestamp_local) - new Date(a.timestamp_local))
    .slice(0, 5);
  // Gecachete laatst bekende GPS-fix (lib/geo/gpsCache.js, gevuld door de
  // dashboardkaart) — geen eigen watchPosition hier nodig voor alleen de
  // afstandsindicatie op de "Recente meldingen"-kaartjes.
  const gpsLocatie = laadGpsCache();

  // Welke dataset de kaart en de detailmodal gebruiken hangt af van het
  // groepsfilter — de kaart zelf (DashboardKaart) blijft in beide gevallen
  // hetzelfde component, alleen de gevoede meldingen + het klik-doel
  // (welke detailmodal) wisselen.
  const kaartMeldingen = groepFilter ? groepData.meldingen : meldingenInBereik;
  const geselecteerd = geselecteerdId
    ? (groepFilter ? groepData.meldingen.find((m) => m.id === geselecteerdId) : meldingenInBereik.find((m) => m.id === geselecteerdId))
    : null;

  return (
    <div className="p-4">
      {!groepFilter ? (
        <div className="dashboard-stats">
          <div className="card dashboard-stat-card">
            <div className="dashboard-stat-label">Totaal</div>
            <div className="dashboard-stat-value">{totaal}</div>
          </div>
          <div className="card dashboard-stat-card">
            <div className="dashboard-stat-label">Deze maand</div>
            <div className="dashboard-stat-value">{dezeMaand}</div>
          </div>
          <div className="card dashboard-stat-card">
            <div className="dashboard-stat-label">Deze week</div>
            <div className="dashboard-stat-value">{dezeWeek}</div>
          </div>
          <div className="card dashboard-stat-card">
            <div className="dashboard-stat-label">Primaire windrichting</div>
            <div className="dashboard-stat-value">{topWind}</div>
          </div>
        </div>
      ) : (
        <div className="dashboard-stats">
          <div className="card dashboard-stat-card">
            <div className="dashboard-stat-label">Leden</div>
            <div className="dashboard-stat-value">{groepStats?.aantalLeden ?? '—'}</div>
          </div>
          <div className="card dashboard-stat-card">
            <div className="dashboard-stat-label">Meldingen</div>
            <div className="dashboard-stat-value">{groepStats?.aantalMeldingen ?? '—'}</div>
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <Suspense fallback={<div className="dashboard-leeg">Kaart laden...</div>}>
          <DashboardKaart
            meldingen={kaartMeldingen}
            thuislocatie={thuislocatie}
            gebruikerRol={gebruikerRol}
            onMeldingSelecteren={setGeselecteerdId}
            mijnGroepen={mijnGroepen}
            groepFilter={groepFilter}
            onGroepFilterChange={setGroepFilter}
          />
        </Suspense>
      </div>

      {!groepFilter ? (
        <>
          <div className="card p-3 dashboard-section">
            <div className="section-label mb-2">Meldingen per maand</div>
            <MaandGrafiek meldingen={meldingenInBereik} />
          </div>

          <div className="dashboard-section">
            <div className="dashboard-section-titel">Recente meldingen</div>
            {recent.length === 0 ? (
              <div className="dashboard-leeg">Nog geen meldingen geregistreerd.</div>
            ) : (
              recent.map((m) => (
                <MeldingCard
                  key={m.id}
                  melding={m}
                  user={user}
                  gebruikerRol={gebruikerRol}
                  onSelecteren={setGeselecteerdId}
                  compact
                  toonLocatieKaartje
                  gpsLocatie={gpsLocatie}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <div className="dashboard-section">
          <div className="dashboard-section-titel">Meldingen in {geselecteerdeGroep?.naam || 'groep'}</div>
          <GroepMeldingenLijst
            groepId={groepFilter}
            viewerTrustScore={profiel?.trust_score}
            viewerUserId={user?.id}
            user={user}
            isBeheerder={isBeheerderVanGroep}
            toonKaart={false}
          />
        </div>
      )}

      {geselecteerd && (
        groepFilter ? (
          <GroepMeldingDetailModal
            melding={geselecteerd}
            toon={groepData.toon}
            isEigen={Boolean(geselecteerd.user_id && geselecteerd.user_id === user?.id)}
            user={user}
            onClose={() => setGeselecteerdId(null)}
          />
        ) : (
          <Suspense fallback={null}>
            <MeldingDetailModal melding={geselecteerd} alleMeldingen={meldingenInBereik} user={user} onClose={() => setGeselecteerdId(null)} />
          </Suspense>
        )
      )}
    </div>
  );
}
