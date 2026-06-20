import { useRef, useState } from 'react';
import { useNieuweMeldingForm } from '../../hooks/useNieuweMeldingForm.js';
import { spuitWindOordeel, degToCompass } from '../../lib/drift/oordeel.js';
import { berekenPasquillKlasse } from '../../lib/weather/pasquill.js';
import { bedrijfSuggesties } from '../../lib/meldingen/bedrijf.js';
import { LocatieKaart } from './LocatieKaart.jsx';
import { CheckboxDropdown } from './CheckboxDropdown.jsx';
import { VoortgangBalk } from './VoortgangBalk.jsx';
import { Toast } from '../ui/Toast.jsx';
import './MeldingForm.css';

const WEER_STATUS_LABEL = {
  geen_locatie: 'Plaats eerst de pin op de kaart',
  laden: 'Laden...',
  actueel: 'Actueel',
  fout: 'Fout bij ophalen',
  offline: 'Offline — geen weerdata'
};

const TYPES = [
  ['spuitactiviteit', '🚜 Spuitactiviteit'],
  ['drift', '🌫 Drift / nevel zichtbaar'],
  ['geur', '👃 Chemische geur'],
  ['nachtelijk', '🌙 Nachtelijke activiteit'],
  ['gezondheid', '🏥 Gezondheidsklachten'],
  ['overig', '📝 Overige waarneming']
];

const ACTIVITEITEN = [
  ['tractor', '🚜 Tractor'],
  ['spuitmachine', '💦 Spuitmachine'],
  ['zwenksproeier', '💧 Zwenksproeier / mestspuiten'],
  ['nachtelijk', '🌙 Nachtelijke activiteit'],
  ['tankvullen', '🛢️ Tank vullen'],
  ['voertuigperceel', '📍 Voertuig op perceel'],
  ['drone_spuiten', '🚁 Drone/UAV spuiten'],
  ['handmatig_spuiten', '🧑 Handmatig/rugspuit']
];

const DRIFT_OPTIES = [
  ['nvt', '🚫 Niet van toepassing'],
  ['nevel_zichtbaar', '🌫 Nevel/drift zichtbaar in de lucht'],
  ['druppels_voelbaar', '💦 Druppels/nevel voelbaar op huid'],
  ['drift_ver', '📏 Drift zichtbaar op meer dan 10 meter'],
  ['geur_direct', '👃 Geur direct waargenomen tijdens spuiten'],
  ['ogen_keel', '👁️ Ogen/keel irritatie bij buitenverblijf'],
  ['drift_op_perceel_grens', '🚧 Drift waarneembaar over perceelgrens'],
  ['neerslag_tuin_auto', '🚗 Neerslag op tuin/auto/was zichtbaar'],
  ['buitenverblijf_gestopt', '🏃 Buitenverblijf vroegtijdig gestopt'],
  ['huisdieren_blootgesteld', '🐾 Huisdieren blootgesteld aan drift'],
  ['spuiten_bij_regen', '🌧️ Spuiten waargenomen bij regen/wind'],
  ['geen_spuitvrije_zone', '📐 Geen spuitvrije zone zichtbaar aangehouden']
];

const GEZONDHEID_OPTIES = [
  ['hoofdpijn', 'Hoofdpijn'],
  ['misselijkheid', 'Misselijkheid'],
  ['benauwdheid', 'Benauwdheid'],
  ['oogirritatie', 'Oogirritatie'],
  ['keelirritatie', 'Keelirritatie'],
  ['darmklachten', 'Darmklachten'],
  ['duizeligheid', 'Duizeligheid'],
  ['vermoeidheid', 'Vermoeidheid']
];

const GEUR_OPTIES = [
  [0, '👃 Geen — geen geurdetectie'],
  [1, '🌱 Licht — geur alleen dichtbij waarneembaar'],
  [2, '🌿 Matig — geur constant waarneembaar'],
  [3, '💨 Sterk — geur duidelijk aanwezig in omgeving'],
  [4, '🤢 Intens — overheersende/prikkelende geur']
];

const WIND_SUBJ_OPTIES = [
  ['geen', '🌬️ Geen — geen merkbare luchtverplaatsing'],
  ['zwak', '🍃 Zwak — lichte bladbeweging zichtbaar'],
  ['matig', '🌿 Matig — wind voelbaar, boomtakken bewegen'],
  ['sterk', '💨 Sterk — voortdurende voelbare wind'],
  ['vlagerig', '🌪️ Wisselend — onregelmatige windstoten aanwezig']
];

const STANDAARD_ZINNEN = [
  ['🚜', 'Spuitactiviteit waargenomen op aangrenzend/nabijgelegen perceel.'],
  ['🔭', 'Spuitactiviteit op afstand waargenomen, geen directe blootstelling.'],
  ['⏱️', 'Spuitactiviteit gedurende langere periode waargenomen.'],
  ['🌫', 'Spuitnevel zichtbaar driftend richting de woning.'],
  ['👃', 'Sterke, ongewone chemische geur waargenomen.'],
  ['📏', 'Spuitactiviteit op minder dan 50 meter van de woning.'],
  ['🚪', 'Ramen en deuren gesloten vanwege geur/nevel.'],
  ['🧒', 'Kinderen/huisdieren naar binnen gehaald vanwege blootstelling.'],
  ['💨', 'Spuitactiviteit bij verhoogde windsnelheid/windvlagen.'],
  ['🌙', 'Nachtelijke spuitactiviteit, buiten reguliere werktijden.'],
  ['🚧', 'Geen spuitvrije zone aangehouden richting de woning.']
];

const GEWAS_OPTGROUPS = [
  ['Sierteelt (hoog risico)', [
    ['Lelie', '🌸 Lelies'], ['Tulp', '🌷 Tulpen'], ['Hyacint', '🌺 Hyacinten'], ['Narcis', '🌼 Narcissen'],
    ['Gladiool', '🌻 Gladiolen'], ['Pioenroos', '🌹 Pioenrozen'], ['Dahlia', '🌸 Dahlia'], ['Overige sierteelt', '🌿 Overige sierteelt']
  ]],
  ['Akkerbouw', [
    ['Aardappel', '🥔 Aardappelen'], ['Suikerbiet', '🌱 Suikerbieten'], ['Tarwe', '🌾 Tarwe/Granen'],
    ['Mais', '🌽 Maïs'], ['Ui', '🧅 Uien'], ['Prei', '🥬 Prei'], ['Overige akkerbouw', '🌱 Overige akkerbouw']
  ]],
  ['Overig', [
    ['Grasland', '🌿 Grasland'], ['Fruitteelt', '🍎 Fruitteelt'], ['Boomkwekerij', '🌳 Boomkwekerij'], ['Overig', '📝 Overig']
  ]]
];

// Komt overeen met het basisformulier-gedeelte van het meldingsformulier uit
// docs/index.html (zonder kaart/PDOK-perceel/weerdata — zie useNieuweMeldingForm.js).
export function MeldingForm({ user, thuislocatie, meldingenApi, syncNu, onOpgeslagen }) {
  const form = useNieuweMeldingForm({ user, thuislocatie, meldingenApi, syncNu });
  const { veld } = form;
  const kaartRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const descRef = useRef(null);
  const telerRef = useRef(null);
  const fotosRef = useRef(null);
  const [telerOpen, setTelerOpen] = useState(true);
  const [bedrijfSuggestiesZichtbaar, setBedrijfSuggestiesZichtbaar] = useState(false);
  const suggesties = bedrijfSuggesties(veld.bedrijfsnaam, meldingenApi.meldingen);

  // Komt overeen met scrollNaarEersteFout() — springt naar het eerste ongeldige veld
  const scrollNaarFout = (el) => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus();
  };

  // Navigatie vanuit de voortgangsbalk-stappen (VoortgangBalk.jsx) naar het
  // bijbehorende formulieronderdeel.
  const STAP_REFS = {
    locatie: kaartRef,
    type: typeDropdownRef,
    omschrijving: descRef,
    fotos: fotosRef,
    teler: telerRef
  };
  const handleStapKlik = (key) => {
    if (key === 'teler') setTelerOpen(true);
    scrollNaarFout(STAP_REFS[key]?.current);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await form.submit();
    if (ok) {
      onOpgeslagen?.();
      return;
    }
    if (veld.lat == null || veld.lng == null) {
      scrollNaarFout(kaartRef.current);
    } else if (!veld.types.length) {
      scrollNaarFout(typeDropdownRef.current);
    } else if (!veld.description.trim()) {
      scrollNaarFout(descRef.current);
    }
  };

  // Voegt een standaardzin toe aan de omschrijving — i.p.v. te vervangen,
  // zodat de melder eigen details kan blijven toevoegen/combineren.
  const voegStandaardZinToe = (zin) => {
    const huidige = veld.description.trim();
    form.zetVeld('description', huidige ? `${huidige} ${zin}` : zin);
    descRef.current?.focus();
  };

  const handleFotoChange = (e) => {
    if (e.target.files?.length) form.voegBestandenToe(e.target.files);
    e.target.value = '';
  };

  return (
    <form className="card melding-form" onSubmit={handleSubmit}>
      <VoortgangBalk veld={veld} onStapKlik={handleStapKlik} />

      <div className="mf-field" ref={kaartRef}>
        <label className="section-label">Locatie {!veld.lat && <span style={{ color: 'var(--danger)' }}>— plaats de pin op de kaart *</span>}</label>
        <LocatieKaart
          lat={veld.lat}
          lng={veld.lng}
          kaartCentrum={veld.kaartCentrum}
          homeLocatie={thuislocatie}
          weather={veld.weather}
          onLocatieGewijzigd={form.zetLocatie}
        />
        <label className="section-label" htmlFor="mf-perceelnummer">Kadastraal perceelnummer</label>
        <div className="locatie-kaart-perceel-row">
          <input
            id="mf-perceelnummer"
            type="text"
            className="form-input"
            readOnly
            placeholder="Klik op het spuitperceel in de kaart ↑"
            value={veld.perceelnummer || ''}
            style={{ color: veld.perceelnummer ? 'var(--text-primary)' : 'var(--text-muted)' }}
          />
        </div>
        {veld.perceelStatus && <div className="locatie-kaart-status">{veld.perceelStatus}</div>}
        <label className="section-label">Afstand tot perceel met woonbestemming</label>
        <div className="locatie-kaart-afstand">
          {veld.afstandWoning != null ? (
            <>
              <div>
                {veld.afstandWoning < 50 ? '⛔' : veld.afstandWoning < 100 ? '⚠️' : '✓'} {veld.afstandWoning}m tot perceel met woonbestemming
                {veld.afstandWoning < 50 ? ' — ONDER DE 50m NORM' : ''}
              </div>
              {veld.afstandWoningLat != null && (
                <div className="locatie-kaart-woning-coords">
                  📍 {veld.afstandWoningLat.toFixed(6)}°N · {veld.afstandWoningLng.toFixed(6)}°E
                </div>
              )}
            </>
          ) : (
            veld.afstandStatus || 'Wordt berekend na plaatsen pin op perceel'
          )}
        </div>
        {form.windNaarWoning?.waait && (
          <div className="locatie-kaart-wind-woning">
            💨 Wind waait richting de woning — wind komt uit {degToCompass(form.windNaarWoning.windDeg)} ({form.windNaarWoning.windDeg}°,
            dus naartoe {degToCompass(form.windNaarWoning.windToeRichting)}/{form.windNaarWoning.windToeRichting}°),
            woning ligt vanaf het meldpunt op {degToCompass(form.windNaarWoning.hoekNaarWoning)}/{form.windNaarWoning.hoekNaarWoning}°
          </div>
        )}
        {veld.natura2000 && (
          <div className="locatie-kaart-natura2000">
            🌿 Nabij: {veld.natura2000.naam}
            {veld.natura2000.lat != null && (
              <div className="locatie-kaart-natura2000-coords">
                📍 {veld.natura2000.lat.toFixed(6)}°N · {veld.natura2000.lng.toFixed(6)}°E
              </div>
            )}
          </div>
        )}
        {veld.kwetsbareLocaties.length > 0 && (
          <div className="locatie-kaart-kwetsbaar">
            <div className="locatie-kaart-kwetsbaar-titel">⚠️ Kwetsbare locaties in de buurt</div>
            {veld.kwetsbareLocaties.map((tekst) => <div key={tekst}>• {tekst}</div>)}
          </div>
        )}
      </div>

      <div className="mf-field">
        <div className="mf-weer-header">
          <label className="section-label">Weerdata (Open-Meteo)</label>
          <span className={`mf-weer-status ${veld.weatherStatus === 'actueel' ? 'mf-weer-status-ok' : ''}`}>
            {veld.weatherStatus === 'actueel' && '✓ '}{WEER_STATUS_LABEL[veld.weatherStatus] || ''}
          </span>
        </div>
        {veld.weather ? (
          <div className="mf-weer-grid">
            <div><div className="section-label">Wind</div><div className="mf-weer-waarde" style={{ color: 'var(--info)' }}>{veld.weather.wind_speed} km/h</div></div>
            <div><div className="section-label">Windrichting</div><div className="mf-weer-waarde">{veld.weather.wind_dir}° ({degToCompass(veld.weather.wind_dir)})</div></div>
            <div><div className="section-label">Windstoten</div><div className="mf-weer-waarde">{veld.weather.wind_gusts} km/h</div></div>
            <div><div className="section-label">Temperatuur</div><div className="mf-weer-waarde">{veld.weather.temperature}°C</div></div>
            <div><div className="section-label">Luchtvochtigheid</div><div className="mf-weer-waarde">{veld.weather.humidity}%</div></div>
            <div><div className="section-label">Neerslag</div><div className="mf-weer-waarde">{veld.weather.precipitation} mm</div></div>
            <div><div className="section-label">Luchtdruk</div><div className="mf-weer-waarde">{veld.weather.pressure} hPa</div></div>
            <div><div className="section-label">Databron</div><div className="mf-weer-waarde mf-weer-bron">{veld.weather.source}</div></div>
          </div>
        ) : null}
        {veld.weather?.wind_speed != null && (() => {
          const pasquill = berekenPasquillKlasse(veld.weather.wind_speed, veld.weather.cloud_cover, veld.weather.is_day);
          return pasquill ? (
            <div className="mf-weer-pasquill">📊 Pasquill stabiliteitsklasse: <strong>{pasquill.klasse}</strong> ({pasquill.label})</div>
          ) : null;
        })()}
        {veld.weather?.wind_speed != null && (() => {
          const oordeel = spuitWindOordeel(veld.weather.wind_speed, veld.weather.wind_gusts, veld.driftWaarneming);
          return (
            <div className="mf-weer-oordeel" style={{ color: oordeel.kleur, borderColor: `${oordeel.kleur}44`, background: `${oordeel.kleur}18` }}>
              {oordeel.icoon} Spuitrichtlijn: {oordeel.tekst}
            </div>
          );
        })()}
        <button
          type="button"
          className="btn-outline px-3 py-1 mf-weer-refresh"
          disabled={veld.lat == null}
          onClick={() => form.haalWeer(veld.lat, veld.lng)}
        >
          ↻ Weerdata vernieuwen
        </button>
      </div>

      <CheckboxDropdown
        ref={typeDropdownRef}
        label="Type waarneming *"
        opties={TYPES}
        geselecteerd={veld.types}
        onToggle={(w) => form.toggleInLijst('types', w)}
        placeholder="Selecteer type(s)..."
        fout={Boolean(form.fout) && !veld.types.length}
      />

      <CheckboxDropdown
        label="Betrokken activiteiten"
        opties={ACTIVITEITEN}
        geselecteerd={veld.activiteiten}
        onToggle={(w) => form.toggleInLijst('activiteiten', w)}
      />

      <div className="mf-field">
        <div className="mf-desc-header">
          <label className="section-label" htmlFor="mf-desc">Omschrijving &amp; notities *</label>
          {veld.description.length > 0 && (
            <button type="button" className="mf-wis-knop" onClick={() => form.zetVeld('description', '')}>
              🗑️ Wis alles
            </button>
          )}
        </div>
        <textarea
          id="mf-desc"
          ref={descRef}
          className="mf-textarea"
          rows={4}
          placeholder="Beschrijf wat je waarneemt: tijd, locatie, activiteit, omstandigheden..."
          value={veld.description}
          onChange={(e) => form.zetVeld('description', e.target.value)}
          style={Boolean(form.fout) && !veld.description.trim() ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px rgba(239,68,68,0.2)' } : undefined}
        />
        <div className="mf-standaardzinnen">
          {STANDAARD_ZINNEN.map(([emoji, zin]) => (
            <button
              key={zin}
              type="button"
              className="mf-standaardzin-chip"
              title={zin}
              onClick={() => voegStandaardZinToe(zin)}
            >
              <span className="mf-standaardzin-chip-emoji">{emoji}</span>
              <span>{zin}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mf-field">
        <label className="section-label" htmlFor="mf-geur">Geurintensiteit</label>
        <select
          id="mf-geur"
          className="mf-select"
          value={veld.geurIntensiteit}
          onChange={(e) => form.zetVeld('geurIntensiteit', parseInt(e.target.value, 10))}
        >
          {GEUR_OPTIES.map(([waarde, label]) => (
            <option key={waarde} value={waarde}>{label}</option>
          ))}
        </select>
      </div>

      <div className="mf-field">
        <label className="section-label" htmlFor="mf-wind-subj">Wind subjectief ervaren</label>
        <select
          id="mf-wind-subj"
          className="mf-select"
          value={veld.windSubjectief}
          onChange={(e) => form.zetVeld('windSubjectief', e.target.value)}
        >
          {WIND_SUBJ_OPTIES.map(([waarde, label]) => (
            <option key={waarde} value={waarde}>{label}</option>
          ))}
        </select>
      </div>

      <CheckboxDropdown
        label="Drift & overlast waarneming"
        opties={DRIFT_OPTIES}
        geselecteerd={veld.driftWaarneming}
        onToggle={form.toggleDrift}
      />

      <div className="mf-field" ref={telerRef}>
        <button type="button" className="mf-teler-toggle" onClick={() => setTelerOpen((o) => !o)}>
          <span>Teler &amp; Gewas</span>
          <span className="mf-teler-chevron" style={{ transform: telerOpen ? 'rotate(180deg)' : '' }}>▼</span>
        </button>
        {telerOpen && (
          <div className="mf-teler-panel">
            <div className="mf-teler-bedrijf-wrap">
              <label className="section-label" htmlFor="mf-bedrijfsnaam">Bedrijfsnaam teler</label>
              <input
                id="mf-bedrijfsnaam"
                type="text"
                className="form-input"
                autoComplete="off"
                placeholder="bijv. Loonbedrijf Jansen"
                value={veld.bedrijfsnaam}
                onChange={(e) => { form.zetVeld('bedrijfsnaam', e.target.value); setBedrijfSuggestiesZichtbaar(true); }}
                onBlur={() => setTimeout(() => setBedrijfSuggestiesZichtbaar(false), 200)}
              />
              {bedrijfSuggestiesZichtbaar && suggesties.length > 0 && (
                <div className="mf-teler-suggesties">
                  {suggesties.map((naam) => (
                    <div key={naam} className="mf-teler-suggestie" onClick={() => { form.zetVeld('bedrijfsnaam', naam); setBedrijfSuggestiesZichtbaar(false); }}>
                      🏢 {naam}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mf-field">
              <label className="section-label" htmlFor="mf-gewas">Gewas</label>
              <select id="mf-gewas" className="mf-select" value={veld.gewas} onChange={(e) => form.zetVeld('gewas', e.target.value)}>
                <option value="">— Onbekend gewas —</option>
                {GEWAS_OPTGROUPS.map(([groep, opties]) => (
                  <optgroup key={groep} label={groep}>
                    {opties.map(([waarde, label]) => <option key={waarde} value={waarde}>{label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="mf-field mf-gezondheid-toestemming">
        <label className="section-label">Gezondheidsklachten registratie</label>
        <label className="mf-checkbox-label">
          <input
            type="checkbox"
            checked={veld.gezondheidToestemming}
            onChange={(e) => form.zetGezondheidToestemming(e.target.checked)}
          />
          Ik geef uitdrukkelijk toestemming voor het registreren van gezondheidsgegevens
          (bijzondere persoonsgegevens, AVG art. 9). Zonder toestemming kunnen geen
          gezondheidsklachten worden geregistreerd bij deze melding.
        </label>
      </div>

      {veld.gezondheidToestemming && (
        <CheckboxDropdown
          label="Gezondheidsklachten (optioneel)"
          opties={GEZONDHEID_OPTIES}
          geselecteerd={veld.gezondheidsklachten}
          onToggle={(w) => form.toggleInLijst('gezondheidsklachten', w)}
        />
      )}

      <div className="mf-field mf-buurt-opt-in">
        <label className="section-label">Deel melding in je buurt</label>
        <label className="mf-checkbox-label">
          <input
            type="checkbox"
            checked={veld.optInBuurt}
            onChange={(e) => form.zetVeld('optInBuurt', e.target.checked)}
          />
          Deel deze melding met andere melders in de buurt (zij kunnen een
          notificatie ontvangen als deze melding binnen hun ingestelde bereik valt)
        </label>
      </div>

      <div className="mf-field" ref={fotosRef}>
        <label className="section-label">Foto's / video's (bewijsmateriaal)</label>
        <div className="mf-foto-buttons">
          <label className="btn-outline px-3 py-2" style={{ cursor: 'pointer', textAlign: 'center', flex: 1 }}>
            📁 Kiezen
            <input type="file" multiple accept="image/*,video/*" className="mf-foto-input" onChange={handleFotoChange} />
          </label>
          <label className="btn-outline px-3 py-2" style={{ cursor: 'pointer', textAlign: 'center', flex: 1 }}>
            📷 Camera
            <input type="file" accept="image/*" capture="environment" className="mf-foto-input" onChange={handleFotoChange} />
          </label>
        </div>
        {veld.bestanden.length > 0 && (
          <div className="mf-photo-grid">
            {veld.bestanden.map((f, idx) => (
              <div key={`${f.name}-${f.lastModified}-${idx}`} className="mf-photo-item">
                {f.type.startsWith('video/')
                  ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🎥</div>
                  : <img src={f.thumbnail || f.dataUrl} alt={f.name} />}
                <button type="button" className="mf-photo-remove" onClick={() => form.verwijderBestand(idx)} title="Verwijder">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {form.fout && <div className="mf-error">{form.fout}</div>}

      <button type="submit" className="btn-primary mf-submit" disabled={form.busy}>
        {form.busy ? (form.stap || 'Opslaan...') : 'Registratie opslaan'}
      </button>

      <Toast melding={form.weerMelding} />
    </form>
  );
}
