import { useCallback, useEffect, useState } from 'react';
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
import { windWaaitNaarWoning } from '../lib/drift/oordeel.js';
import { haalWeerdata, windSubjectiefVanSnelheid } from '../lib/weather/openMeteo.js';
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
    activiteiten: [...STANDAARD_ACTIVITEITEN],
    bestanden: [],
    lat: thuislocatie?.lat ?? 52.3676,
    lng: thuislocatie?.lng ?? 5.2006,
    gpsAccuracy: null,
    gpsStatus: 'standaard locatie',
    perceelnummer: null,
    perceelStatus: null,
    afstandWoning: null,
    afstandWoningLat: null,
    afstandWoningLng: null,
    afstandStatus: null,
    natura2000: null,
    kwetsbareLocaties: [],
    windNaarWoning: null,
    weather: null,
    weatherStatus: 'laden'
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

    zoekNatura2000InDeBuurt(lat, lng)
      .then((natura2000) => setVeld((v) => ({ ...v, natura2000 })))
      .catch(() => setVeld((v) => ({ ...v, natura2000: null })));

    zoekKwetsbareLocaties(lat, lng)
      .then((kwetsbareLocaties) => setVeld((v) => ({ ...v, kwetsbareLocaties })))
      .catch(() => setVeld((v) => ({ ...v, kwetsbareLocaties: [] })));

    if (metWeer) haalWeer(lat, lng);
  }, [haalWeer]);

  // Wind-naar-woning-analyse: kan pas berekend worden zodra zowel de
  // woninglocatie (zetLocatie) als de windrichting (haalWeer, async en later)
  // bekend zijn — komt overeen met het windanalyse-deel van
  // detecteerAfstandEnNatura2000() uit docs/index.html.
  useEffect(() => {
    const windDeg = veld.weather?.wind_dir;
    if (windDeg == null || veld.afstandWoningLat == null || veld.afstandWoningLng == null) return;
    const analyse = windWaaitNaarWoning(windDeg, veld.lat, veld.lng, veld.afstandWoningLat, veld.afstandWoningLng);
    setVeld((v) => ({
      ...v,
      windNaarWoning: analyse?.waait
        ? { waait: true, windDeg, hoekNaarWoning: analyse.hoekNaarWoning, afstandM: v.afstandWoning }
        : null
    }));
  }, [veld.weather?.wind_dir, veld.afstandWoningLat, veld.afstandWoningLng, veld.lat, veld.lng]);

  // Eerste weerdata ophalen voor de startlocatie (de pin staat bij het laden
  // van het formulier al op de thuislocatie/standaardlocatie)
  useEffect(() => {
    const timer = setTimeout(() => haalWeer(veld.lat, veld.lng), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        afstand_woning: veld.afstandWoning ?? null,
        wind_naar_woning: veld.windNaarWoning,
        natura2000: veld.natura2000,
        kwetsbare_locaties: veld.kwetsbareLocaties,
        geur_intensiteit: veld.geurIntensiteit,
        wind_subjectief: veld.windSubjectief,
        drift_waarneming: veld.driftWaarneming.filter((d) => d !== 'nvt'),
        richting_deg: richtingDeg,
        richting_compass: degToCompass(richtingDeg),
        gezondheidsklachten: veld.gezondheidsklachten,
        activiteiten: veld.activiteiten,
        weather: veld.weather || { status: 'niet beschikbaar' },
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
  }, [veld, user, meldingenApi, syncNu, reset]);

  return {
    veld,
    busy,
    stap,
    fout,
    weerMelding,
    zetVeld,
    toggleInLijst,
    toggleDrift,
    zetLocatie,
    haalWeer,
    voegBestandenToe,
    verwijderBestand,
    submit
  };
}
