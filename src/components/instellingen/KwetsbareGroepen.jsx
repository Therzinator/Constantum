import { useEffect, useState } from 'react';
import { haalGebruikersProfiel, slaKwetsbareGroepenOp } from '../../lib/supabase/profiel.js';
import { Toast } from '../ui/Toast.jsx';

const STERK = [
  { id: 'kinderen', label: 'Kinderen (0–12 jaar)' },
  { id: 'ouderen', label: 'Ouderen (65+)' },
  { id: 'zwangeren', label: 'Zwangere personen of zwangerschap gepland' },
  { id: 'copd_astma', label: 'Chronische longaandoening (COPD/astma)' },
  { id: 'hart_vaat', label: 'Hart- en vaatziekten' },
];

const SUBSTANTIEEL = [
  { id: 'diabetes', label: 'Diabetes mellitus' },
  { id: 'nierfalen', label: 'Chronisch nierfalen' },
  { id: 'immunosuppressie', label: 'Immunosuppressieve behandeling' },
  { id: 'neurologisch', label: 'Neurologische aandoening (Parkinson, MS, ALS)' },
  { id: 'mcs', label: 'Multipele chemische sensitiviteit (MCS)' },
  { id: 'post_covid', label: 'Post-COVID / Long COVID' },
];

const ALLE_IDS = [...STERK, ...SUBSTANTIEEL].map((c) => c.id);

function labelVoorId(id) {
  return [...STERK, ...SUBSTANTIEEL].find((c) => c.id === id)?.label ?? id;
}

// AVG art. 9 — bijzondere categorie: gezondheidsgegevens. Vereist uitdrukkelijke
// aparte toestemming vóór verwerking. Toestemming-timestamp wordt opgeslagen in
// user_profiles.kwetsbare_groepen_toestemming_op.
export function KwetsbareGroepen({ user }) {
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);
  const [geladen, setGeladen] = useState(false);

  // Huidige opgeslagen staat
  const [actief, setActief] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState([]);

  // Bewerkformulier-staat (state A)
  const [bewerkModus, setBewerkModus] = useState(false);
  const [toestemming, setToestemming] = useState(false);
  const [conceptKeuze, setConceptKeuze] = useState([]);

  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  useEffect(() => {
    if (!user) return;
    haalGebruikersProfiel(user.id).then((profiel) => {
      if (!profiel) { setGeladen(true); return; }
      setActief(!!profiel.kwetsbare_groepen_actief);
      const opgeslagen = profiel.kwetsbare_groepen ?? [];
      setGeselecteerd(Array.isArray(opgeslagen) ? opgeslagen : []);
      setGeladen(true);
    });
  }, [user]);

  const openBewerkModus = () => {
    setConceptKeuze([...geselecteerd]);
    setToestemming(false);
    setBewerkModus(true);
  };

  const toggleCategorie = (id) => {
    setConceptKeuze((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id]
    );
  };

  const handleOpslaan = async () => {
    if (!toestemming) {
      toon('Geef uitdrukkelijke toestemming voor verwerking van deze gezondheidsgegevens', 'error');
      return;
    }
    if (!conceptKeuze.length) {
      toon('Selecteer minstens één categorie', 'error');
      return;
    }
    setBezig(true);
    try {
      const nu = new Date().toISOString();
      await slaKwetsbareGroepenOp(user.id, {
        actief: true,
        groepen: conceptKeuze,
        toestemmingOp: nu
      });
      setActief(true);
      setGeselecteerd(conceptKeuze);
      setBewerkModus(false);
      toon('✓ Kwetsbare-groepen-instelling opgeslagen', 'success');
    } catch (e) {
      toon('Opslaan mislukt: ' + e.message, 'error');
    } finally {
      setBezig(false);
    }
  };

  const handleUitschakelen = async () => {
    if (!confirm('Kwetsbare-groepen-instelling uitschakelen? Toekomstige meldingen krijgen geen kwetsbare-groep-markering meer.')) return;
    setBezig(true);
    try {
      await slaKwetsbareGroepenOp(user.id, { actief: false, groepen: null, toestemmingOp: null });
      setActief(false);
      setGeselecteerd([]);
      setBewerkModus(false);
      toon('Kwetsbare-groepen-instelling uitgeschakeld', '');
    } catch (e) {
      toon('Uitschakelen mislukt: ' + e.message, 'error');
    } finally {
      setBezig(false);
    }
  };

  if (!geladen) return null;

  // State B: actief — toon samenvatting
  if (actief && !bewerkModus) {
    return (
      <div>
        <div className="export-card-beschrijving mb-3">
          Kwetsbare personen in uw huishouden zijn geregistreerd. Toekomstige meldingen
          worden automatisch gemarkeerd met ⚠️ in het dossier.
        </div>
        <div className="mb-3">
          <strong>Geselecteerde categorieën:</strong>
          <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
            {geselecteerd.map((id) => (
              <li key={id} style={{ fontSize: '0.85rem', marginBottom: 2 }}>
                {labelVoorId(id)}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn-outline px-4 py-2" onClick={openBewerkModus} disabled={bezig}>
            ✏️ Categorieën wijzigen
          </button>
          <button
            type="button"
            className="btn-outline px-4 py-2"
            style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
            onClick={handleUitschakelen}
            disabled={bezig}
          >
            Uitschakelen
          </button>
        </div>
        <Toast melding={melding} />
      </div>
    );
  }

  // State A: bewerkformulier — consent + checkboxen
  return (
    <div>
      <div className="export-card-beschrijving mb-3">
        Als er kwetsbare personen in uw huishouden wonen (kinderen, ouderen, mensen met
        bepaalde aandoeningen), worden uw meldingen automatisch voorzien van een
        ⚠️-markering in het dossier. Dit versterkt de juridische relevantie van uw
        meldingen — kwetsbaarheid is een erkende verzwarende omstandigheid bij
        beoordeling van pesticideblootstelling.
      </div>

      <div
        className="card p-3 mb-3"
        style={{ borderColor: 'var(--warning)', background: 'rgba(234,179,8,0.06)' }}
      >
        <strong style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
          AVG artikel 9 — bijzondere categorie persoonsgegevens
        </strong>
        <div className="export-card-beschrijving mt-1">
          Gezondheidsgegevens vallen onder een verhoogd beschermingsniveau. Constatum
          slaat deze gegevens uitsluitend op in uw eigen profiel — ze worden nooit
          gedeeld met andere gebruikers, groepen of buurtgenoten. Alleen u en de
          beheerder kunnen ze inzien.
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={toestemming}
            onChange={(e) => setToestemming(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.85rem' }}>
            Ik begrijp dat dit gezondheidsgegevens zijn (AVG art. 9) en geef{' '}
            <strong>uitdrukkelijke toestemming</strong> voor de verwerking hiervan
            door Constatum, uitsluitend voor het doel van juridische documentatie.
          </span>
        </label>
      </div>

      {toestemming && (
        <>
          <div className="section-label mb-2" style={{ fontSize: '0.8rem' }}>
            Sterk wetenschappelijk bewijs
          </div>
          {STERK.map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={conceptKeuze.includes(c.id)}
                onChange={() => toggleCategorie(c.id)}
              />
              <span style={{ fontSize: '0.85rem' }}>{c.label}</span>
            </label>
          ))}

          <div className="section-label mb-2 mt-3" style={{ fontSize: '0.8rem' }}>
            Substantieel bewijs
          </div>
          {SUBSTANTIEEL.map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={conceptKeuze.includes(c.id)}
                onChange={() => toggleCategorie(c.id)}
              />
              <span style={{ fontSize: '0.85rem' }}>{c.label}</span>
            </label>
          ))}
        </>
      )}

      <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-outline px-4 py-2"
          onClick={handleOpslaan}
          disabled={bezig || !toestemming}
        >
          {bezig ? '⏳ Opslaan...' : '✓ Opslaan & activeren'}
        </button>
        {actief && (
          <button type="button" className="btn-outline px-4 py-2" onClick={() => setBewerkModus(false)} disabled={bezig}>
            Annuleren
          </button>
        )}
      </div>
      <Toast melding={melding} />
    </div>
  );
}
