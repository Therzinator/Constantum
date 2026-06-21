import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import Collection from 'ol/Collection.js';
import { Point, LineString, Circle as CircleGeom } from 'ol/geom.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import LayerGroup from 'ol/layer/Group.js';
import Translate from 'ol/interaction/Translate.js';
import Overlay from 'ol/Overlay.js';
import { unByKey } from 'ol/Observable.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj.js';
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
import { maakNatura2000Laag, vulNatura2000Laag } from '../../lib/pdok/natura2000Laag.js';
import { haalBestemming } from '../../lib/pdok/bestemming.js';
import { maakDriftZoneLayer } from '../../lib/drift/driftzone.js';
import { maakWindAnimatieLaag, vulWindAnimatieDeeltjes, startWindAnimatie } from '../../lib/drift/windAnimatieLaag.js';
import { laadGpsCache, slaGpsCacheOp } from '../../lib/geo/gpsCache.js';
import '../dashboard/DashboardKaart.css';
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

// Zelfde popup-opmaak/logica als natura2000PopupHtml() in DashboardKaart.jsx.
function natura2000PopupHtml(props) {
  const naam = props.naamN2K || props.naam || 'Natura 2000-gebied';
  const heeftHabitat = Boolean(props.sitecodeH?.trim());
  const heeftVogel = Boolean(props.sitecodeV?.trim());
  const type =
    heeftHabitat && heeftVogel ? 'Habitat- & Vogelrichtlijngebied'
      : heeftHabitat ? 'Habitatrichtlijngebied'
      : heeftVogel ? 'Vogelrichtlijngebied'
      : 'Natura 2000-gebied';
  const sitecodes = [props.sitecodeH, props.sitecodeV].filter((c) => c?.trim()).join(' · ');

  return `<div class="dashboard-kaart-natura-popup">
    <div class="dashboard-kaart-natura-popup-titel">🌳 ${naam}</div>
    <div class="dashboard-kaart-natura-popup-rij">${type}</div>
    ${sitecodes ? `<div class="dashboard-kaart-natura-popup-rij">Sitecode: ${sitecodes}</div>` : ''}
    ${props.status ? `<div class="dashboard-kaart-natura-popup-rij">${props.status}</div>` : ''}
  </div>`;
}

// Zelfde popup-opmaak/logica als perceelPopupHtml() in DashboardKaart.jsx,
// incl. de asynchroon nageleverde bestemming (lib/pdok/bestemming.js).
function perceelPopupHtml(props, bestemming) {
  const gemeente = props.AKRKadastraleGemeenteCode || props.kadastralegemeentecode || props.kadastraleGemeentenaam || '';
  const sectie = props.sectie || '';
  const nummer = props.perceelnummer || '';
  const perceelId = `${gemeente}${sectie}-${nummer}`.toUpperCase().replace(/^-|-$/g, '');
  const grootte = props.kadastraleGrootteWaarde ?? props.grootte;

  return `<div class="dashboard-kaart-perceel-popup">
    <div class="dashboard-kaart-perceel-popup-titel">📐 Kadastraal perceel</div>
    ${perceelId ? `<div class="dashboard-kaart-perceel-popup-rij">${perceelId}</div>` : ''}
    ${grootte != null ? `<div class="dashboard-kaart-perceel-popup-rij">Oppervlakte: ${grootte} m²</div>` : ''}
    ${bestemming === undefined ? '<div class="dashboard-kaart-perceel-popup-rij">⏳ Bestemming laden...</div>' : ''}
    ${bestemming?.naam ? `<div class="dashboard-kaart-perceel-popup-rij">Bestemming: ${bestemming.naam}</div>` : ''}
  </div>`;
}

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
  const bestemmingAanvraagRef = useRef(0);
  const luchtLaagRef = useRef(null);
  const gebruikerMarkerRef = useRef(null);
  const gebruikerCirkelRef = useRef(null);
  const gebruikerSourceRef = useRef(null);
  const perceelLaagRef = useRef(null);
  const perceelMoveendKeyRef = useRef(null);
  const natura2000LaagRef = useRef(null);
  const natura2000MoveendKeyRef = useRef(null);
  const driftGroepRef = useRef(null);
  const meetSourceRef = useRef(null);
  const meetModusRef = useRef(false);
  const windLaagRef = useRef(null);
  const windStopRef = useRef(null);
  const gpsGecentreerdRef = useRef(false);
  const zoomListenerKeyRef = useRef(null);
  const [kaartModus, setKaartModus] = useState('osm'); // 'osm' | 'lucht'
  const [driftAan, setDriftAan] = useState(false);
  const [natura2000Aan, setNatura2000Aan] = useState(false);
  const [perceelAan, setPerceelAan] = useState(false);
  const [huidigeZoom, setHuidigeZoom] = useState(15);
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

    // Zelfde lagen/toggle-gedrag als DashboardKaart.jsx — percelen/Natura2000
    // staan hier net als daar standaard UIT (maakPerceelgrenzenLaag()/
    // maakNatura2000Laag() leveren visible:false), aangezet via de
    // toggle-knoppenbalk boven de kaart.
    const perceelLaag = maakPerceelgrenzenLaag();
    perceelLaagRef.current = perceelLaag;

    const natura2000Laag = maakNatura2000Laag();
    natura2000LaagRef.current = natura2000Laag;

    const driftGroep = new LayerGroup({ layers: [], visible: false });
    driftGroepRef.current = driftGroep;

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
      controls: defaultControls(),
      layers: [osmLaag, luchtLaag, natura2000Laag, perceelLaag, driftGroep, homeLaag, gebruikerLaag, windLaag, meldLaag, meetLaag],
      view: new View({ center: fromLonLat([startLng, startLat]), zoom: lat == null ? 13 : 15 })
    });

    setHuidigeZoom(map.getView().getZoom());
    zoomListenerKeyRef.current = map.getView().on('change:resolution', () => {
      setHuidigeZoom(Math.round(map.getView().getZoom()));
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

    const n2000OverlayEl = document.createElement('div');
    n2000OverlayEl.className = 'dashboard-kaart-popup';
    const n2000Overlay = new Overlay({ element: n2000OverlayEl, offset: [0, -12], positioning: 'bottom-center', stopEvent: true });
    map.addOverlay(n2000Overlay);

    map.on('click', (evt) => {
      // Natura2000-gebied alleen aanklikbaar zolang de laag zichtbaar is —
      // net als op het Dashboard. Toont een infopopup i.p.v. de meldingspin
      // te verplaatsen.
      if (natura2000Laag.getVisible()) {
        const n2000Feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === natura2000Laag });
        if (n2000Feature) {
          n2000OverlayEl.innerHTML = natura2000PopupHtml(n2000Feature.getProperties());
          n2000Overlay.setPosition(evt.coordinate);
          return;
        }
      }
      if (perceelLaagRef.current?.getVisible()) {
        const perceelFeature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === perceelLaagRef.current });
        if (perceelFeature) {
          const props = perceelFeature.getProperties();
          n2000OverlayEl.innerHTML = perceelPopupHtml(props, undefined);
          n2000Overlay.setPosition(evt.coordinate);

          const aanvraagToken = ++bestemmingAanvraagRef.current;
          const [klikLng, klikLat] = toLonLat(evt.coordinate);
          haalBestemming(klikLat, klikLng).then((bestemming) => {
            if (aanvraagToken !== bestemmingAanvraagRef.current) return;
            n2000OverlayEl.innerHTML = perceelPopupHtml(props, bestemming);
          });
          return;
        }
      }
      n2000Overlay.setPosition(undefined);

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
      if (natura2000MoveendKeyRef.current) {
        unByKey(natura2000MoveendKeyRef.current);
        natura2000MoveendKeyRef.current = null;
      }
      if (perceelMoveendKeyRef.current) {
        unByKey(perceelMoveendKeyRef.current);
        perceelMoveendKeyRef.current = null;
      }
      if (zoomListenerKeyRef.current) {
        unByKey(zoomListenerKeyRef.current);
        zoomListenerKeyRef.current = null;
      }
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
      natura2000LaagRef.current = null;
      driftGroepRef.current = null;
      meetSourceRef.current = null;
      windLaagRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perceelgrenzen rond de huidige meldingspin ophalen — alleen zolang de
  // toggle aan staat (zelfde gedrag als DashboardKaart.jsx).
  useEffect(() => {
    if (!perceelAan || !perceelLaagRef.current || lat == null || lng == null) return;
    vulPerceelgrenzenLaag(perceelLaagRef.current, lat, lng);
  }, [perceelAan, lat, lng]);

  // Komt overeen met toggleFormKaartLaag() — wisselt tussen stratenkaart en PDOK-luchtfoto
  const wisselKaartLaag = () => {
    if (!luchtLaagRef.current) return;
    const volgendeModus = kaartModus === 'osm' ? 'lucht' : 'osm';
    luchtLaagRef.current.setVisible(volgendeModus === 'lucht');
    setKaartModus(volgendeModus);
  };

  // Zelfde patroon als wisselPerceel()/wisselNatura2000() in DashboardKaart.jsx.
  const verversPerceelgrenzen = () => {
    if (!mapRef.current || !perceelLaagRef.current) return;
    const center = mapRef.current.getView().getCenter();
    if (!center) return;
    const [centerLng, centerLat] = toLonLat(center);
    vulPerceelgrenzenLaag(perceelLaagRef.current, centerLat, centerLng);
  };

  const wisselPerceel = () => {
    const volgende = !perceelAan;
    setPerceelAan(volgende);
    perceelLaagRef.current?.setVisible(volgende);
    if (volgende) {
      if (lat != null && lng != null) vulPerceelgrenzenLaag(perceelLaagRef.current, lat, lng);
      if (mapRef.current && !perceelMoveendKeyRef.current) {
        perceelMoveendKeyRef.current = mapRef.current.on('moveend', verversPerceelgrenzen);
      }
    } else if (perceelMoveendKeyRef.current) {
      unByKey(perceelMoveendKeyRef.current);
      perceelMoveendKeyRef.current = null;
    }
  };

  const verversNatura2000 = () => {
    if (!mapRef.current || !natura2000LaagRef.current) return;
    const extent3857 = mapRef.current.getView().calculateExtent(mapRef.current.getSize());
    const extentLonLat = transformExtent(extent3857, 'EPSG:3857', 'EPSG:4326');
    vulNatura2000Laag(natura2000LaagRef.current, extentLonLat);
  };

  const wisselNatura2000 = () => {
    const volgende = !natura2000Aan;
    setNatura2000Aan(volgende);
    natura2000LaagRef.current?.setVisible(volgende);
    if (volgende) {
      verversNatura2000();
      if (mapRef.current && !natura2000MoveendKeyRef.current) {
        natura2000MoveendKeyRef.current = mapRef.current.on('moveend', verversNatura2000);
      }
    } else if (natura2000MoveendKeyRef.current) {
      unByKey(natura2000MoveendKeyRef.current);
      natura2000MoveendKeyRef.current = null;
    }
  };

  // Driftzone voor de IN-AANMAAK-zijnde melding (huidige pin + actuele
  // windrichting), i.p.v. historische meldingen zoals op het Dashboard —
  // zelfde maakDriftZoneLayer()-functie, alleen op andere inputdata.
  const wisselDriftLaag = () => {
    setDriftAan((vorige) => !vorige);
  };

  useEffect(() => {
    const driftGroep = driftGroepRef.current;
    if (!driftGroep) return;
    driftGroep.setVisible(driftAan);
    driftGroep.getLayers().clear();
    if (!driftAan || lat == null || lng == null || weather?.wind_dir == null) return;
    const laag = maakDriftZoneLayer({ gps: { lat, lng }, weather, type: 'spuitactiviteit' });
    if (laag) driftGroep.getLayers().push(laag);
  }, [driftAan, lat, lng, weather]);

  // Centreert de kaartweergave op de eigen GPS-positie van de melder (blauwe
  // marker) — verplaatst bewust NIET de meldingspin, die mag alleen de
  // gebruiker zelf zetten via klikken/slepen op de kaart.
  const centreerOpGPS = () => {
    if (!mapRef.current || !gebruikerMarkerRef.current) return;
    mapRef.current.getView().animate({ center: gebruikerMarkerRef.current.getGeometry().getCoordinates(), zoom: 16 });
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
      <div className="dashboard-kaart-balk">
        <button type="button" className={`dashboard-kaart-toggle ${kaartModus === 'lucht' ? 'actief-lucht' : ''}`} onClick={wisselKaartLaag}>
          {kaartModus === 'osm' ? '🛰️ Luchtfoto' : '🗺️ Kaart'}
        </button>
        <button type="button" className={`dashboard-kaart-toggle ${driftAan ? 'actief-drift' : ''}`} onClick={wisselDriftLaag}>
          🌬️ Driftzone{driftAan ? ' aan' : ''}
        </button>
        <button type="button" className={`dashboard-kaart-toggle ${natura2000Aan ? 'actief-natura' : ''}`} onClick={wisselNatura2000}>
          🌳 Natura2000{natura2000Aan ? ' aan' : ''}
        </button>
        <button type="button" className={`dashboard-kaart-toggle ${perceelAan ? 'actief-perceel' : ''}`} onClick={wisselPerceel}>
          🗺️ Percelen{perceelAan ? ' aan' : ''}
        </button>
      </div>

      <div className="dashboard-kaart-kaart-houder">
        <div ref={containerRef} className="locatie-kaart" />
        <span className="dashboard-kaart-zoom-badge">🔍 Zoom {huidigeZoom}</span>
        <button
          type="button"
          className="dashboard-kaart-gps-knop"
          onClick={centreerOpGPS}
          disabled={!gpsBeschikbaar}
          title="Centreer kaart op jouw GPS-locatie"
        >
          📍
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
      </div>

      {meetModus && meetAfstand != null && (
        <div className="locatie-kaart-status">📏 Afstand vanaf GPS-positie: {meetAfstand} m</div>
      )}
    </div>
  );
}
