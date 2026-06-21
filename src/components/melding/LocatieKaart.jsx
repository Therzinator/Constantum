import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import Collection from 'ol/Collection.js';
import { Point, LineString, Circle as CircleGeom } from 'ol/geom.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Translate from 'ol/interaction/Translate.js';
import Overlay from 'ol/Overlay.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { getLength } from 'ol/sphere.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Text from 'ol/style/Text.js';
import 'ol/ol.css';
import { degToCompass } from '../../lib/drift/oordeel.js';
import { maakOsmLaag, maakLuchtfotoLaag } from '../../lib/ol/lagen.js';
import { maakPerceelgrenzenLaag, vulPerceelgrenzenLaag } from '../../lib/pdok/perceelLaag.js';
import { maakWindAnimatieLaag, vulWindAnimatieDeeltjes, startWindAnimatie } from '../../lib/drift/windAnimatieLaag.js';
import { laadGpsCache, slaGpsCacheOp } from '../../lib/geo/gpsCache.js';
import './LocatieKaart.css';

function puntStijl(kleur, straal = 7, randBreedte = 3) {
  return new Style({
    image: new CircleStyle({ radius: straal, fill: new Fill({ color: kleur }), stroke: new Stroke({ color: '#fff', width: randBreedte }) })
  });
}

const HOME_STIJL = puntStijl('#00d4aa', 7);
const MELD_STIJL = puntStijl('#f59e0b', 7);
const GEBRUIKER_STIJL = puntStijl('#3b82f6', 7);
const GEBRUIKER_CIRKEL_STIJL = new Style({
  stroke: new Stroke({ color: '#3b82f6', width: 1 }),
  fill: new Fill({ color: 'rgba(59,130,246,0.08)' })
});
const MEET_LIJN_STIJL = (label) =>
  new Style({
    stroke: new Stroke({ color: '#00d4aa', width: 2, lineDash: [6, 4] }),
    text: new Text({
      text: label,
      font: '11px monospace',
      fill: new Fill({ color: '#fff' }),
      backgroundFill: new Fill({ color: 'rgba(0,0,0,0.75)' }),
      padding: [3, 6, 3, 6]
    })
  });

// Komt overeen met updateFormMarkerWindPopup() — toont windrichting/-kracht
// als popup direct bij de meldingspin, met een eigen sluit-kruisje (net als
// sluitWindPopup() in docs/index.html — een eigen icoon i.p.v. de standaard
// close-knop, die onbetrouwbaar samenwerkt met een verplaatsbare marker).
function windPopupHtml(weather) {
  const deg = weather.wind_dir ?? 0;
  const speed = weather.wind_speed ?? '?';
  const gusts = weather.wind_gusts ?? '?';
  const label = degToCompass(deg);
  const arrowSvg = `<svg width="36" height="36" viewBox="0 0 36 36" style="display:block;margin:0 auto 4px;">
    <circle cx="18" cy="18" r="16" fill="rgba(0,212,170,0.12)" stroke="rgba(0,212,170,0.5)" stroke-width="1.5"/>
    <g transform="rotate(${deg},18,18)">
      <polygon points="18,5 14,22 18,19 22,22" fill="#00d4aa"/>
      <polygon points="18,31 14,14 18,17 22,14" fill="rgba(0,212,170,0.3)"/>
    </g>
    <circle cx="18" cy="18" r="2.5" fill="#00d4aa"/>
  </svg>`;
  return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;text-align:center;min-width:110px;position:relative;">
    <div class="wind-popup-close" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:rgba(100,116,139,0.18);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:#475569;line-height:1;" title="Sluiten">×</div>
    ${arrowSvg}
    <div style="font-weight:700;color:#00d4aa;">${label} · ${deg}°</div>
    <div style="color:#7a90b0;margin-top:2px;">${speed} km/h · vlagen ${gusts} km/h</div>
    <div style="color:#4a5568;font-size:9px;margin-top:2px;">windrichting nu</div>
  </div>`;
}

// React-versie van initFormMap() uit docs/index.html — kaart met thuislocatie,
// een verplaatsbare meldingspin (oranje) én de eigen, live GPS-positie van de
// melder (blauw) — bewust twee afzonderlijke markers, want de melding kan op
// een ander punt staan (bv. het waargenomen perceel) dan waar de melder zelf
// staat. `lat`/`lng` zijn de huidige meldingscoördinaten, `weather` (optioneel)
// toont windrichting/-kracht als popup bij de meldingspin,
// `onLocatieGewijzigd(lat, lng)` wordt aangeroepen bij klikken/verschuiven van die pin.
//
// Gemigreerd van Leaflet naar OpenLayers 10 — zelfde functionaliteit, plus
// een perceelgrenzen-WFS-laag (PDOK, EPSG:28992) en een meetlint-tool
// (afstand vanaf de eigen GPS-positie).
export function LocatieKaart({ lat, lng, kaartCentrum, homeLocatie, weather, onLocatieGewijzigd }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const meldFeatureRef = useRef(null);
  const meldSourceRef = useRef(null);
  const translateRef = useRef(null);
  const overlayRef = useRef(null);
  const luchtLaagRef = useRef(null);
  const gebruikerMarkerRef = useRef(null);
  const gebruikerCirkelRef = useRef(null);
  const gebruikerSourceRef = useRef(null);
  const perceelLaagRef = useRef(null);
  const meetSourceRef = useRef(null);
  const meetModusRef = useRef(false);
  const windLaagRef = useRef(null);
  const windStopRef = useRef(null);
  const gpsGecentreerdRef = useRef(false);
  const [kaartModus, setKaartModus] = useState('osm'); // 'osm' | 'lucht'
  const [gpsBeschikbaar, setGpsBeschikbaar] = useState(() => laadGpsCache() != null);
  const [meetModus, setMeetModus] = useState(false);
  const [meetAfstand, setMeetAfstand] = useState(null);

  // Sluit de windpopup (kruisje) én stopt/wist de windvector-animatie — beide
  // horen bij elkaar, anders blijft de pijltjesstroom onzichtbaar doorlopen
  // nadat de popup al gesloten is.
  const sluitWindPopup = () => {
    overlayRef.current?.setPosition(undefined);
    windStopRef.current?.();
    windStopRef.current = null;
    windLaagRef.current?.setVisible(false);
    windLaagRef.current?.getSource().clear();
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Zonder geplaatste pin start de kaart op de laatst bekende GPS-cache
    // (sneller op positie dan wachten op een verse fix), anders de
    // thuislocatie/NL-centrum — dat punt is alleen het kaartmidden, geen meldpunt.
    const gpsCache = laadGpsCache();
    const startLat = lat ?? gpsCache?.lat ?? kaartCentrum?.lat ?? 52.3676;
    const startLng = lng ?? gpsCache?.lng ?? kaartCentrum?.lng ?? 5.2006;

    const osmLaag = maakOsmLaag();
    const luchtLaag = maakLuchtfotoLaag();
    luchtLaagRef.current = luchtLaag;

    const homeSource = new VectorSource();
    if (homeLocatie?.lat && homeLocatie?.lng) {
      const homeFeature = new Feature({ geometry: new Point(fromLonLat([homeLocatie.lng, homeLocatie.lat])) });
      homeFeature.setStyle(HOME_STIJL);
      homeSource.addFeature(homeFeature);
    }
    const homeLaag = new VectorLayer({ source: homeSource, zIndex: 3 });

    const meldSource = new VectorSource();
    meldSourceRef.current = meldSource;
    const meldLaag = new VectorLayer({ source: meldSource, zIndex: 10 });

    const gebruikerSource = new VectorSource();
    gebruikerSourceRef.current = gebruikerSource;
    const gebruikerLaag = new VectorLayer({ source: gebruikerSource, zIndex: 2 });

    // Toon de gecachete GPS-positie meteen (blauwe stip), nog vóór de eerste
    // live watchPosition-fix binnen is — wordt zodra die fix er is gewoon
    // bijgewerkt i.p.v. opnieuw aangemaakt.
    if (gpsCache) {
      const cacheCoord = fromLonLat([gpsCache.lng, gpsCache.lat]);
      const marker = new Feature({ geometry: new Point(cacheCoord) });
      marker.setStyle(GEBRUIKER_STIJL);
      const cirkel = new Feature({ geometry: new CircleGeom(cacheCoord, gpsCache.accuracy || 0) });
      cirkel.setStyle(GEBRUIKER_CIRKEL_STIJL);
      gebruikerSource.addFeature(cirkel);
      gebruikerSource.addFeature(marker);
      gebruikerMarkerRef.current = marker;
      gebruikerCirkelRef.current = cirkel;
    }

    const perceelLaag = maakPerceelgrenzenLaag();
    perceelLaagRef.current = perceelLaag;

    const meetSource = new VectorSource();
    meetSourceRef.current = meetSource;
    const meetLaag = new VectorLayer({ source: meetSource, zIndex: 11 });

    const windLaag = maakWindAnimatieLaag();
    windLaagRef.current = windLaag;

    if (lat != null && lng != null) {
      const meldFeature = new Feature({ geometry: new Point(fromLonLat([lng, lat])) });
      meldFeature.setStyle(MELD_STIJL);
      meldSource.addFeature(meldFeature);
      meldFeatureRef.current = meldFeature;
    }

    const map = new Map({
      target: containerRef.current,
      controls: [],
      layers: [osmLaag, luchtLaag, perceelLaag, homeLaag, gebruikerLaag, windLaag, meldLaag, meetLaag],
      view: new View({ center: fromLonLat([startLng, startLat]), zoom: lat == null ? 13 : 15 })
    });

    const overlayEl = document.createElement('div');
    overlayEl.className = 'locatie-kaart-windpopup';
    const overlay = new Overlay({ element: overlayEl, offset: [0, -16], positioning: 'bottom-center', stopEvent: true });
    map.addOverlay(overlay);
    overlayRef.current = overlay;

    const toonWindPopup = (coord) => {
      if (!weather) return;
      overlayEl.innerHTML = windPopupHtml(weather);
      overlay.setPosition(coord);
      const closeBtn = overlayEl.querySelector('.wind-popup-close');
      if (closeBtn) closeBtn.onclick = (ev) => { ev.stopPropagation(); sluitWindPopup(); };
    };
    if (meldFeatureRef.current && weather) {
      toonWindPopup(meldFeatureRef.current.getGeometry().getCoordinates());
    }

    const translateFeatures = new Collection(meldFeatureRef.current ? [meldFeatureRef.current] : []);
    const translate = new Translate({ features: translateFeatures });
    translate.on('translateend', (evt) => {
      const [nieuweLng, nieuweLat] = toLonLat(evt.coordinate);
      overlay.setPosition(evt.coordinate);
      onLocatieGewijzigd(nieuweLat, nieuweLng, { metWeer: true });
    });
    map.addInteraction(translate);
    translateRef.current = translate;

    map.on('click', (evt) => {
      if (meetModusRef.current) {
        const gebruikerFeature = gebruikerMarkerRef.current;
        if (!gebruikerFeature) return;
        const van = gebruikerFeature.getGeometry().getCoordinates();
        const lijn = new LineString([van, evt.coordinate]);
        const lengteM = Math.round(getLength(lijn, { projection: 'EPSG:3857' }));
        meetSource.clear();
        const lijnFeature = new Feature({ geometry: lijn });
        lijnFeature.setStyle(MEET_LIJN_STIJL(`${lengteM} m`));
        meetSource.addFeature(lijnFeature);
        setMeetAfstand(lengteM);
        return;
      }

      const [klikLng, klikLat] = toLonLat(evt.coordinate);
      if (!meldFeatureRef.current) {
        const meldFeature = new Feature({ geometry: new Point(evt.coordinate) });
        meldFeature.setStyle(MELD_STIJL);
        meldSource.addFeature(meldFeature);
        meldFeatureRef.current = meldFeature;
        translateFeatures.push(meldFeature);
      } else {
        meldFeatureRef.current.getGeometry().setCoordinates(evt.coordinate);
      }
      overlay.setPosition(undefined);
      onLocatieGewijzigd(klikLat, klikLng, { metWeer: true });
    });

    mapRef.current = map;
    setTimeout(() => map.updateSize(), 100);

    // Eigen GPS-positie van de melder — los van de meldingspin, continu
    // bijgewerkt zolang het formulier open staat.
    let watchId = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (!gebruikerSourceRef.current) return;
          const coord = fromLonLat([longitude, latitude]);
          if (!gebruikerMarkerRef.current) {
            const marker = new Feature({ geometry: new Point(coord) });
            marker.setStyle(GEBRUIKER_STIJL);
            const cirkel = new Feature({ geometry: new CircleGeom(coord, accuracy || 0) });
            cirkel.setStyle(GEBRUIKER_CIRKEL_STIJL);
            gebruikerSourceRef.current.addFeature(cirkel);
            gebruikerSourceRef.current.addFeature(marker);
            gebruikerMarkerRef.current = marker;
            gebruikerCirkelRef.current = cirkel;
          } else {
            gebruikerMarkerRef.current.getGeometry().setCoordinates(coord);
            gebruikerCirkelRef.current.getGeometry().setCenterAndRadius(coord, accuracy || 0);
          }
          setGpsBeschikbaar(true);
          slaGpsCacheOp(latitude, longitude, accuracy);
          // Bij het openen van het formulier (nog geen meldingspin geplaatst)
          // automatisch naar de GPS-positie springen — eenmalig per mount, en
          // niet als de melder zelf al een pin heeft staan (die blijft leidend).
          if (!gpsGecentreerdRef.current && !meldFeatureRef.current && mapRef.current) {
            gpsGecentreerdRef.current = true;
            mapRef.current.getView().animate({ center: coord, zoom: 15, duration: 500 });
          }
        },
        (err) => console.warn('[LocatieKaart] GPS van melder niet beschikbaar:', err.message),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      windStopRef.current?.();
      windStopRef.current = null;
      map.setTarget(null);
      mapRef.current = null;
      meldFeatureRef.current = null;
      meldSourceRef.current = null;
      translateRef.current = null;
      overlayRef.current = null;
      luchtLaagRef.current = null;
      gebruikerMarkerRef.current = null;
      gebruikerCirkelRef.current = null;
      gebruikerSourceRef.current = null;
      perceelLaagRef.current = null;
      meetSourceRef.current = null;
      windLaagRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perceelgrenzen rond de huidige meldingspin ophalen — zelfde trigger als
  // de oude "volgt externe lat/lng-wijzigingen"-effect, plus initieel.
  useEffect(() => {
    if (!perceelLaagRef.current || lat == null || lng == null) return;
    vulPerceelgrenzenLaag(perceelLaagRef.current, lat, lng);
  }, [lat, lng]);

  // Komt overeen met toggleFormKaartLaag() — wisselt tussen stratenkaart en PDOK-luchtfoto
  const wisselKaartLaag = () => {
    if (!luchtLaagRef.current) return;
    const volgendeModus = kaartModus === 'osm' ? 'lucht' : 'osm';
    luchtLaagRef.current.setVisible(volgendeModus === 'lucht');
    setKaartModus(volgendeModus);
  };

  // Centreert de kaartweergave op de eigen GPS-positie van de melder (blauwe
  // marker) — verplaatst bewust NIET de meldingspin, die mag alleen de
  // gebruiker zelf zetten via klikken/slepen op de kaart.
  const centreerOpGPS = () => {
    if (!mapRef.current || !gebruikerMarkerRef.current) return;
    mapRef.current.getView().animate({ center: gebruikerMarkerRef.current.getGeometry().getCoordinates(), zoom: 16 });
  };

  const zoomIn = () => {
    const view = mapRef.current?.getView();
    if (view) view.animate({ zoom: view.getZoom() + 1 });
  };
  const zoomOut = () => {
    const view = mapRef.current?.getView();
    if (view) view.animate({ zoom: view.getZoom() - 1 });
  };

  const wisselMeetModus = () => {
    const volgende = !meetModus;
    meetModusRef.current = volgende;
    setMeetModus(volgende);
    if (!volgende) {
      meetSourceRef.current?.clear();
      setMeetAfstand(null);
    }
  };

  // Volgt externe lat/lng-wijzigingen (bv. na GPS-detectie) zonder click/drag te triggeren
  useEffect(() => {
    if (!meldFeatureRef.current || lat == null || lng == null) return;
    const huidige = toLonLat(meldFeatureRef.current.getGeometry().getCoordinates());
    if (Math.abs(huidige[1] - lat) > 1e-9 || Math.abs(huidige[0] - lng) > 1e-9) {
      const coord = fromLonLat([lng, lat]);
      meldFeatureRef.current.getGeometry().setCoordinates(coord);
      mapRef.current?.getView().animate({ center: coord });
    }
  }, [lat, lng]);

  // Werkt de windpopup bij zodra weerdata (opnieuw) beschikbaar komt — opent
  // de popup opnieuw met de nieuwe waarden (de gebruiker kan die altijd weer
  // sluiten via het kruisje).
  useEffect(() => {
    if (!meldFeatureRef.current || !overlayRef.current || !weather) return;
    const coord = meldFeatureRef.current.getGeometry().getCoordinates();
    overlayRef.current.getElement().innerHTML = windPopupHtml(weather);
    overlayRef.current.setPosition(coord);
    const closeBtn = overlayRef.current.getElement().querySelector('.wind-popup-close');
    if (closeBtn) closeBtn.onclick = (ev) => { ev.stopPropagation(); sluitWindPopup(); };
  }, [weather]);

  // Geanimeerde windvector-laag bij de meldingspin — stroompje van pijltjes
  // dat in de afdrift-richting beweegt, snelheid schaalt met wind_speed.
  // Draait alleen zolang er weerdata + een geplaatste pin is; stopt en wist
  // zichzelf zodra een van beide wegvalt (bv. pin nog niet geplaatst).
  useEffect(() => {
    if (!windLaagRef.current || !mapRef.current) return;
    windStopRef.current?.();
    windStopRef.current = null;

    if (weather?.wind_dir == null || lat == null || lng == null) {
      windLaagRef.current.setVisible(false);
      windLaagRef.current.getSource().clear();
      return;
    }

    vulWindAnimatieDeeltjes(windLaagRef.current, [{ lat, lng, windDir: weather.wind_dir, windSpeed: weather.wind_speed }]);
    windLaagRef.current.setVisible(true);
    windStopRef.current = startWindAnimatie(mapRef.current, windLaagRef.current);

    return () => {
      windStopRef.current?.();
      windStopRef.current = null;
    };
  }, [weather, lat, lng]);

  return (
    <div className="locatie-kaart-wrap">
      <div ref={containerRef} className="locatie-kaart" />
      <button type="button" className="locatie-kaart-laag-btn" onClick={wisselKaartLaag}>
        {kaartModus === 'osm' ? '🛰️ Luchtfoto' : '🗺️ Kaart'}
      </button>
      <button
        type="button"
        className="locatie-kaart-gps-btn"
        onClick={centreerOpGPS}
        disabled={!gpsBeschikbaar}
        title="Centreer kaart op jouw GPS-locatie"
      >
        📍 GPS
      </button>
      <button
        type="button"
        className={`locatie-kaart-meet-btn${meetModus ? ' actief' : ''}`}
        onClick={wisselMeetModus}
        disabled={!gpsBeschikbaar}
        title="Meet afstand vanaf jouw GPS-locatie"
      >
        📏 Meten
      </button>
      <div className="locatie-kaart-zoom">
        <button type="button" onClick={zoomIn} title="Inzoomen" aria-label="Inzoomen">+</button>
        <button type="button" onClick={zoomOut} title="Uitzoomen" aria-label="Uitzoomen">−</button>
      </div>
      {meetModus && meetAfstand != null && (
        <div className="locatie-kaart-status">📏 Afstand vanaf GPS-positie: {meetAfstand} m</div>
      )}
    </div>
  );
}
