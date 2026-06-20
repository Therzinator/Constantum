import { useCallback, useMemo, useState } from 'react';
import { generateId } from '../utils/format.js';
import { degToCompass } from '../lib/drift/oordeel.js';
import { sha256, hashFile } from '../lib/bewijsmateriaal/hash.js';
import { extractEXIF, stripEXIFGPS } from '../lib/bewijsmateriaal/exif.js';
import { compressToThumbnail } from '../lib/media/thumbnail.js';
import { vraagRFC3161Timestamp } from '../lib/supabase/rfc3161Relay.js';
import { sbAuditLog } from '../lib/supabase/auditLog.js';
import { idbSaveBijlage } from '../lib/storage/indexedDB.js';
import { zoekPerceelPDOK } from '../lib/pdok/perceel.js';
import { zoekDichtstbijzijndeWoning } from '../lib/pdok/woning.js';
import { zoekNatura2000InDeBuurt } from '../lib/pdok/natura2000.js';
import { zoekKwetsbareLocaties } from '../lib/pdok/kwetsbareLocaties.js';
import { zoekPostcodePDOK } from '../lib/pdok/postcode.js';
import { windWaaitNaarWoning } from '../lib/drift/oordeel.js';
import { haalWeerdata, windSubjectiefVanSnelheid } from '../lib/weather/openMeteo.js';
import { berekenPasquillKlasse } from '../lib/weather/pasquill.js';
import { laadDeelVoorkeur } from '../lib/notificaties/deelvoorkeur.js';
import { APP_VERSION_CLIENT } from '../lib/version.js';
import { SUPABASE_ENABLED } from '../lib/supabase/client.js';

const STANDAARD_ACTIVITEITEN = ['tractor', 'spuitmachine'];

function leegFormulier(thuislocatie) {
  return {
    types: ['spuitactiviteit'],
    description: '',
    geurIntensiteit: 0,
    windSubjectief: 'geen',
    driftWaarneming: ['nvt'],
    richtingDeg: 0,
    gezondheidsklachten: [],
    gezondheidToestemming: false,
    // Vooringevuld met de bewaarde voorkeur (Instellingen) — per melding
    // altijd nog aan/uit te zetten, zie checkbox in MeldingForm.jsx.
    optInBuurt: laadDeelVoorkeur(),
    activiteiten: [...STANDAARD_ACTIVITEITEN],
    bestanden: [],
    // Geen standaard meldpunt — de gebruiker moet de pin zelf op de kaart
    // plaatsen (klikken/slepen). `kaartCentrum` is alleen waar de kaart
    // (zonder pin) op start staat, niet de meldingslocatie zelf.
    lat: null,
    lng: null,
    kaartCentrum: { lat: thuislocatie?.lat ?? 52.3676, lng: thuislocatie?.lng ?? 5.2006 },
    gpsAccuracy: null,
    gpsStatus: 'nog niet geplaatst',
    perceelnummer: null,
    perceelStatus: null,
    postcode: null,
    afstandWoning: null,
    afstandWoningLat: null,
    afstandWoningLng: null,
    afstandStatus: null,
    natura2000: null,
    kwetsbareLocaties: [],
    bedrijfsnaam: '',
    gewas: '',
    weather: null,
    weatherStatus: 'geen_locatie'
  };
}

// Komt overeen met het basisformulier-deel van submitMelding() uit docs/index.html,
// inclusief de kaart/PDOK-perceel-detectie (detecteerPerceel) en de BAG-woning-
// afstand (detecteerAfstandEnNatura2000, zonder Natura2000/kwetsbare-locaties —
// die horen bij een latere fase). `meldingenApi` komt uit hooks/useMeldingen.js,
// `thuislocatie` uit hooks/useThuislocatie.js, `user` uit hooks/useAuth.js.
export function useNieuweMeldingForm({ user, thuislocatie, meldingenApi, syncNu }) {
  const [veld, setVeld] = useState(() => leegFormulier(thuislocatie));
  const [busy, setBusy] = useState(false);
  const [stap, setStap] = useState(null);
  const [fout, setFout] = useState(null);
  const [weerMelding, setWeerMelding] = useState(null);

  const zetVeld = useCallback((naam, waarde) => {
    setVeld((v) => ({ ...v, [naam]: waarde }));
  }, []);

  const toggleInLijst = useCallback((naam, waarde) => {
    setVeld((v) => {
      const lijst = v[naam];
      const next = lijst.includes(waarde)
        ? lijst.filter((x) => x !== waarde)
        : [...lijst, waarde];
      return { ...v, [naam]: next };
    });
  }, []);

  // AVG art. 9: gezondheidsgegevens zijn bijzondere persoonsgegevens — vereisen
  // uitdrukkelijke toestemming. Intrekken wist meteen de al gekozen klachten.
  const zetGezondheidToestemming = useCallback((toestemming) => {
    setVeld((v) => ({
      ...v,
      gezondheidToestemming: toestemming,
      gezondheidsklachten: toestemming ? v.gezondheidsklachten : []
    }));
  }, []);

  // Drift-checkbox 'nvt' is exclusief met de overige drift-opties
  const toggleDrift = useCallback((waarde) => {
    setVeld((v) => {
      if (waarde === 'nvt') {
        const aan = !v.driftWaarneming.includes('nvt');
        return { ...v, driftWaarneming: aan ? ['nvt'] : [] };
      }
      const zonderNvt = v.driftWaarneming.filter((x) => x !== 'nvt');
      const next = zonderNvt.includes(waarde)
        ? zonderNvt.filter((x) => x !== waarde)
        : [...zonderNvt, waarde];
      return { ...v, driftWaarneming: next };
    });
  }, []);

  // Komt overeen met fetchWeather() — wind subjectief en windrichting worden
  // automatisch voorgevuld op basis van de gemeten waarden.
  const haalWeer = useCallback(async (lat, lng) => {
    setVeld((v) => ({ ...v, weatherStatus: 'laden' }));
    try {
      const weather = await haalWeerdata(lat, lng);
      setVeld((v) => ({
        ...v,
        weather,
        weatherStatus: 'actueel',
        windSubjectief: windSubjectiefVanSnelheid(weather.wind_speed, weather.wind_gusts),
        richtingDeg: weather.wind_dir
      }));
      setWeerMelding({ id: Date.now(), tekst: '✓ Weerdata geactualiseerd', type: 'success' });
    } catch {
      setVeld((v) => ({
        ...v,
        weatherStatus: navigator.onLine ? 'fout' : 'offline'
      }));
    }
  }, []);

  // Komt overeen met detecteerPerceel() + detecteerAfstandEnNatura2000(),
  // aangeroepen na het zetten van de meldingspin. Deze pin mag UITSLUITEND door
  // de gebruiker zelf gezet worden (klikken/slepen op de kaart) — nooit
  // automatisch op basis van de eigen GPS-positie van de melder (die wordt apart
  // getoond als blauwe marker in LocatieKaart.jsx). `metWeer: true` (altijd het
  // geval bij klik/sleep) genereert ook de windpopup bij de pin.
  const zetLocatie = useCallback((lat, lng, { metWeer = false } = {}) => {
    setVeld((v) => ({
      ...v,
      lat,
      lng,
      gpsStatus: 'handmatig gekozen',
      perceelStatus: 'Perceel opzoeken...',
      afstandStatus: 'Woningen opzoeken...'
    }));

    zoekPerceelPDOK(lat, lng)
      .then((perceelId) => {
        setVeld((v) => ({
          ...v,
          perceelnummer: perceelId,
          perceelStatus: perceelId ? `✓ ${perceelId}` : 'Geen perceel op deze locatie'
        }));
      })
      .catch(() => setVeld((v) => ({ ...v, perceelStatus: 'Opvragen mislukt' })));

    zoekNatura2000InDeBuurt(lat, lng)
      .then((natura2000) => setVeld((v) => ({ ...v, natura2000 })))
      .catch(() => setVeld((v) => ({ ...v, natura2000: null })));

    // Woningafstand staat al apart vermeld (zie afstandWoning hieronder) —
    // hier alleen de óvérige kwetsbare locaties (speeltuin, school, zorg,
    // ...), op afstand gesorteerd. Afstand wordt berekend tot de rand van
    // het gebouw, niet het centroïde (zie lib/geo/polygonAfstand.js).
    zoekDichtstbijzijndeWoning(lat, lng)
      .then((woning) => {
        setVeld((v) => ({
          ...v,
          afstandWoning: woning?.afstandM ?? null,
          afstandWoningLat: woning?.lat ?? null,
          afstandWoningLng: woning?.lng ?? null,
          afstandStatus: woning ? null : 'Geen woningen gevonden binnen 300m'
        }));
      })
      .catch(() => setVeld((v) => ({ ...v, afstandStatus: 'Afstand berekenen mislukt' })));

    zoekKwetsbareLocaties(lat, lng)
      .then((kwetsbareLocaties) => setVeld((v) => ({ ...v, kwetsbareLocaties })))
      .catch(() => setVeld((v) => ({ ...v, kwetsbareLocaties: [] })));

    // Alleen voor het admin-dashboard (opt-in-melders per postcode,
    // Fase 4) — geen invloed op het formulier zelf, dus stilletjes falen.
    zoekPostcodePDOK(lat, lng)
      .then((postcode) => setVeld((v) => ({ ...v, postcode })))
      .catch(() => setVeld((v) => ({ ...v, postcode: null })));

    if (metWeer) haalWeer(lat, lng);
  }, [haalWeer]);

  // Wind-naar-woning-analyse: afgeleide waarde (geen state) — kan pas
  // berekend worden zodra zowel de woninglocatie (zetLocatie) als de
  // windrichting (haalWeer, async en later) bekend zijn. Komt overeen met
  // het windanalyse-deel van detecteerAfstandEnNatura2000() uit docs/index.html.
  const windNaarWoning = useMemo(() => {
    const windDeg = veld.weather?.wind_dir;
    if (windDeg == null || veld.afstandWoningLat == null || veld.afstandWoningLng == null) return null;
    const analyse = windWaaitNaarWoning(windDeg, veld.lat, veld.lng, veld.afstandWoningLat, veld.afstandWoningLng);
    return analyse?.waait
      ? { waait: true, windDeg, windToeRichting: (windDeg + 180) % 360, hoekNaarWoning: analyse.hoekNaarWoning, afstandM: veld.afstandWoning }
      : null;
  }, [veld.weather?.wind_dir, veld.afstandWoningLat, veld.afstandWoningLng, veld.lat, veld.lng, veld.afstandWoning]);

  const voegBestandenToe = useCallback(async (files) => {
    for (const file of Array.from(files)) {
      const hash = await hashFile(file);
      const exif = await extractEXIF(file);
      const rawDataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target.result);
        r.onerror = () => reject(new Error('Bestand lezen mislukt'));
        r.readAsDataURL(file);
      });
      const isVideo = file.type.startsWith('video/');
      const dataUrl = isVideo ? rawDataUrl : await stripEXIFGPS(rawDataUrl, file.type);
      const thumbnail = isVideo ? null : await compressToThumbnail(dataUrl, file.type);

      const obj = {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        hash,
        exif,
        thumbnail,
        dataUrl
      };
      setVeld((v) => ({ ...v, bestanden: [...v.bestanden, obj] }));
    }
  }, []);

  const verwijderBestand = useCallback((index) => {
    setVeld((v) => ({ ...v, bestanden: v.bestanden.filter((_, i) => i !== index) }));
  }, []);

  const reset = useCallback(() => {
    setVeld(leegFormulier(thuislocatie));
    setFout(null);
  }, [thuislocatie]);

  const submit = useCallback(async () => {
    setFout(null);

    if (veld.lat == null || veld.lng == null) {
      setFout('Plaats de meldingspin op de kaart — klik op de juiste locatie');
      return false;
    }
    if (!veld.types.length) {
      setFout('Selecteer minstens één type waarneming');
      return false;
    }
    const desc = veld.description.trim();
    if (!desc) {
      setFout('Voer een omschrijving in — beschrijf wat je waarneemt');
      return false;
    }

    setBusy(true);
    setStap('Opslaan...');

    try {
      const now = new Date();
      const meldingId = generateId();
      const richtingDeg = veld.richtingDeg || 0;

      const melding = {
        id: meldingId,
        timestamp_local: now.toISOString(),
        timestamp_utc: now.toISOString(),
        date: now.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
        time: now.toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
        timezone: 'Europe/Amsterdam',
        device: navigator.userAgent.substring(0, 120),
        platform: navigator.platform,
        gps: {
          lat: veld.lat,
          lng: veld.lng,
          accuracy: veld.gpsAccuracy,
          status: veld.gpsStatus
        },
        type: veld.types[0],
        types: veld.types,
        description: desc,
        melder_email: user?.email ? await sha256(user.email) : null,
        perceelnummer: veld.perceelnummer || null,
        postcode: veld.postcode || null,
        afstand_woning: veld.afstandWoning ?? null,
        wind_naar_woning: windNaarWoning,
        natura2000: veld.natura2000,
        kwetsbare_locaties: veld.kwetsbareLocaties,
        bedrijfsnaam: veld.bedrijfsnaam.trim() || null,
        gewas: veld.gewas || null,
        geur_intensiteit: veld.geurIntensiteit,
        wind_subjectief: veld.windSubjectief,
        drift_waarneming: veld.driftWaarneming.filter((d) => d !== 'nvt'),
        richting_deg: richtingDeg,
        richting_compass: degToCompass(richtingDeg),
        gezondheidsklachten: veld.gezondheidsklachten,
        gezondheid_toestemming: veld.gezondheidToestemming,
        opt_in_buurt: veld.optInBuurt,
        activiteiten: veld.activiteiten,
        weather: veld.weather
          ? { ...veld.weather, pasquill: berekenPasquillKlasse(veld.weather.wind_speed, veld.weather.cloud_cover, veld.weather.is_day) }
          : { status: 'niet beschikbaar' },
        bestanden: veld.bestanden.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          lastModified: f.lastModified,
          hash: f.hash,
          exif: f.exif || null,
          thumbnail: f.thumbnail || null,
          dataUrl: null
        })),
        warnings: [],
        version: APP_VERSION_CLIENT,
        hash: null,
        sync_status: 'lokaal',
        sync_at: null
      };

      melding.hash = await sha256(JSON.stringify({ ...melding, hash: null }));

      setStap('RFC 3161 tijdstempel ophalen...');
      melding.rfc3161 = await vraagRFC3161Timestamp(melding.hash);

      if (SUPABASE_ENABLED && user) {
        sbAuditLog(meldingId, 'created', {
          type: melding.type,
          hash: melding.hash,
          rfc3161: melding.rfc3161?.timestamp || null,
          gps: veld.lat ? `${veld.lat.toFixed(5)},${veld.lng.toFixed(5)}` : null,
          online: navigator.onLine
        }, user);
      }

      meldingenApi.voegMeldingToe(melding);

      if (veld.bestanden.length > 0) {
        setStap("Foto's opslaan...");
        for (const f of veld.bestanden) {
          await idbSaveBijlage({
            id: `${meldingId}_${f.name}_${f.lastModified}`,
            meldingId,
            name: f.name,
            type: f.type,
            size: f.size,
            hash: f.hash,
            dataUrl: f.dataUrl
          });
        }
      }

      if (SUPABASE_ENABLED && user && navigator.onLine && syncNu) {
        syncNu().catch(() => {});
      }

      reset();
      return true;
    } catch (e) {
      setFout(e.message || 'Opslaan mislukt');
      return false;
    } finally {
      setBusy(false);
      setStap(null);
    }
  }, [veld, user, meldingenApi, syncNu, reset, windNaarWoning]);

  return {
    veld,
    windNaarWoning,
    busy,
    stap,
    fout,
    weerMelding,
    zetVeld,
    toggleInLijst,
    zetGezondheidToestemming,
    toggleDrift,
    zetLocatie,
    haalWeer,
    voegBestandenToe,
    verwijderBestand,
    submit
  };
}
