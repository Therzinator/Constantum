import { useEffect, useMemo, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import { Circle as CircleGeom, Point } from 'ol/geom.js';
import VectorLayer from 'ol/layer/Vector.js';
import HeatmapLayer from 'ol/layer/Heatmap.js';
import VectorSource from 'ol/source/Vector.js';
import Cluster from 'ol/source/Cluster.js';
import LayerGroup from 'ol/layer/Group.js';
import Overlay from 'ol/Overlay.js';
import { unByKey } from 'ol/Observable.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Text from 'ol/style/Text.js';
import 'ol/ol.css';
import { maakDriftZoneLayer } from '../../lib/drift/driftzone.js';
import { maakOsmLaag, maakLuchtfotoLaag } from '../../lib/ol/lagen.js';
import { maakNatura2000Laag, vulNatura2000Laag } from '../../lib/pdok/natura2000Laag.js';
import { maakPerceelgrenzenLaag, vulPerceelgrenzenLaag } from '../../lib/pdok/perceelLaag.js';
import { laadGpsVoorkeur } from '../../lib/dashboard/gpsVoorkeur.js';
import { laadGpsCache, slaGpsCacheOp } from '../../lib/geo/gpsCache.js';
import { isCoordinatorOfAdmin } from '../../lib/rollen.js';
import { gebruikerKleur, melderCode } from '../../utils/format.js';
import './DashboardKaart.css';

const GEBRUIKER_STIJL = new Style({
  image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#3b82f6' }), stroke: new Stroke({ color: '#fff', width: 3 }) })
});
const GEBRUIKER_CIRKEL_STIJL = new Style({
  stroke: new Stroke({ color: '#3b82f6', width: 1 }),
  fill: new Fill({ color: 'rgba(59,130,246,0.08)' })
});

const TYPE_KLEUREN = {
  spuitactiviteit: '#f59e0b',
  drift: '#3b82f6',
  geur: '#8b5cf6',
  gezondheid: '#ef4444',
  geluid: '#f97316',
  overig: '#6b7280'
};

const MAAND_OPTIES = [
  ['huidig', 'Deze maand'], ['', 'Alle maanden'], ['01', 'Januari'], ['02', 'Februari'], ['03', 'Maart'],
  ['04', 'April'], ['05', 'Mei'], ['06', 'Juni'], ['07', 'Juli'], ['08', 'Augustus'],
  ['09', 'September'], ['10', 'Oktober'], ['11', 'November'], ['12', 'December']
];

const DAG_OPTIES = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

// Hard begrensd om de kaart bij een drukke buurt/groot tijdvak niet te laten
// vastlopen op duizenden features — zie MELDINGEN_KAART_LIMIET-melding
// hieronder in de JSX, die de gebruiker hier expliciet op wijst (voorheen
// werd dit stilzwijgend afgekapt, zonder dat zichtbaar te maken).
const MELDINGEN_KAART_LIMIET = 100;

function clusterStijl(feature) {
  const onderliggend = feature.get('features');
  const aantal = onderliggend.length;
  if (aantal === 1) {
    const m = onderliggend[0].get('melding');
    const typeKleur = TYPE_KLEUREN[m.type] || '#6b7280';
    const randKleur = gebruikerKleur(m.melder_email);
    const d = new Date(m.timestamp_local);
    const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return new Style({
      image: new CircleStyle({ radius: 5, fill: new Fill({ color: typeKleur }), stroke: new Stroke({ color: randKleur, width: 2 }) }),
      text: new Text({
        text: dateLabel,
        offsetY: 12,
        font: '9px monospace',
        fill: new Fill({ color: '#fff' }),
        stroke: new Stroke({ color: 'rgba(0,0,0,0.8)', width: 2 })
      })
    });
  }
  return new Style({
    image: new CircleStyle({
      radius: 12,
      fill: new Fill({ color: 'rgba(0,212,170,0.85)' }),
      stroke: new Stroke({ color: '#fff', width: 2 })
    }),
    text: new Text({ text: String(aantal), font: 'bold 11px monospace', fill: new Fill({ color: '#0d1520' }) })
  });
}

// PDOK-WFS levert beschermingstype als 'HR' (Habitatrichtlijn), 'VR'
// (Vogelrichtlijn) of beide gecombineerd via afzonderlijke sitecodes —
// sitecodeV/sitecodeH zijn ' ' (spatie) i.p.v. leeg/null als niet van
// toepassing, dus expliciet trimmen vóór de leegte-check.
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

// Zelfde veldnamen als zoekPerceelPDOK() in lib/pdok/perceel.js — PDOK
// levert de kadastrale gemeentecode wisselend onder AKRKadastraleGemeenteCode
// of kadastralegemeentecode, vandaar de fallback-keten.
function perceelPopupHtml(props) {
  const gemeente = props.AKRKadastraleGemeenteCode || props.kadastralegemeentecode || props.kadastraleGemeentenaam || '';
  const sectie = props.sectie || '';
  const nummer = props.perceelnummer || '';
  const perceelId = `${gemeente}${sectie}-${nummer}`.toUpperCase().replace(/^-|-$/g, '');
  const grootte = props.kadastraleGrootteWaarde ?? props.grootte;

  return `<div class="dashboard-kaart-perceel-popup">
    <div class="dashboard-kaart-perceel-popup-titel">📐 Kadastraal perceel</div>
    ${perceelId ? `<div class="dashboard-kaart-perceel-popup-rij">${perceelId}</div>` : ''}
    ${grootte != null ? `<div class="dashboard-kaart-perceel-popup-rij">Oppervlakte: ${grootte} m²</div>` : ''}
  </div>`;
}

// Komt overeen met initDashMap()/updateDashboard() (kaartgedeelte) uit
// docs/index.html: meldingmarkers + driftzones op een kaart met
// luchtfoto/driftlaag-toggle en maand/jaar-filter.
//
// Gemigreerd van Leaflet naar OpenLayers 10 — meldingen worden nu via
// ol/source/Cluster gegroepeerd (i.p.v. losse markers), met een vectorlaag
// voor Natura2000-gebieden als extra toggle.
export function DashboardKaart({ meldingen, thuislocatie, gebruikerRol, onMeldingSelecteren }) {
  const magHotspotsZien = isCoordinatorOfAdmin(gebruikerRol);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const meldingenSourceRef = useRef(null);
  const driftGroepRef = useRef(null);
  const luchtLaagRef = useRef(null);
  const natura2000LaagRef = useRef(null);
  const natura2000MoveendKeyRef = useRef(null);
  const perceelLaagRef = useRef(null);
  const perceelMoveendKeyRef = useRef(null);
  const gebruikerSourceRef = useRef(null);
  const gebruikerMarkerRef = useRef(null);
  const gebruikerCirkelRef = useRef(null);
  const gpsGecentreerdRef = useRef(false);
  const overlayRef = useRef(null);
  const clusterLaagRef = useRef(null);
  const heatmapLaagRef = useRef(null);
  const zoomListenerKeyRef = useRef(null);
  const [luchtAan, setLuchtAan] = useState(false);
  const [driftAan, setDriftAan] = useState(false);
  const [natura2000Aan, setNatura2000Aan] = useState(false);
  const [perceelAan, setPerceelAan] = useState(false);
  const [heatmapAan, setHeatmapAan] = useState(false);
  const [huidigeZoom, setHuidigeZoom] = useState(13);
  const [maandFilter, setMaandFilter] = useState('huidig');
  const [jaarFilter, setJaarFilter] = useState('');
  const [dagFilter, setDagFilter] = useState('');
  const [gpsAan] = useState(() => laadGpsVoorkeur());
  const [gpsFout, setGpsFout] = useState(() =>
    !navigator.geolocation ? 'Geolocatie wordt niet ondersteund door deze browser' : null
  );

  const jaren = useMemo(
    () => [...new Set(meldingen.map((m) => new Date(m.timestamp_local).getFullYear()))].sort((a, b) => b - a),
    [meldingen]
  );

  const gefiltered = useMemo(() => {
    const now = new Date();
    return meldingen.filter((m) => {
      const d = new Date(m.timestamp_local);
      if (maandFilter === 'huidig') {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else if (maandFilter && String(d.getMonth() + 1).padStart(2, '0') !== maandFilter) {
        return false;
      }
      if (jaarFilter && String(d.getFullYear()) !== jaarFilter) return false;
      if (dagFilter && String(d.getDate()).padStart(2, '0') !== dagFilter) return false;
      return true;
    });
  }, [meldingen, maandFilter, jaarFilter, dagFilter]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Zonder ingestelde thuislocatie (nieuwe gebruiker) eerst de gecachete
    // laatst bekende GPS-positie proberen — sneller op positie dan het
    // NL-centrum, ook als de live GPS-pin (Instellingen) uit staat.
    const gpsCache = laadGpsCache();
    const lat = thuislocatie?.lat ?? gpsCache?.lat ?? 52.3676;
    const lng = thuislocatie?.lng ?? gpsCache?.lng ?? 5.2006;

    const osmLaag = maakOsmLaag();
    const luchtLaag = maakLuchtfotoLaag();
    luchtLaagRef.current = luchtLaag;

    const homeSource = new VectorSource();
    const homeFeature = new Feature({ geometry: new Point(fromLonLat([lng, lat])) });
    homeFeature.setStyle(
      new Style({ image: new CircleStyle({ radius: 8, fill: new Fill({ color: '#00d4aa' }), stroke: new Stroke({ color: '#fff', width: 3 }) }) })
    );
    homeSource.addFeature(homeFeature);
    const homeLaag = new VectorLayer({ source: homeSource, zIndex: 3 });

    const meldingenSource = new VectorSource();
    meldingenSourceRef.current = meldingenSource;
    const clusterSource = new Cluster({ source: meldingenSource, distance: 32 });
    const clusterLaag = new VectorLayer({ source: clusterSource, style: clusterStijl, zIndex: 10 });
    clusterLaagRef.current = clusterLaag;

    // Heatmap als alternatieve weergave van dezelfde meldingenSource — niet
    // geclusterd, dus dichtheid blijft zichtbaar ook als je inzoomt.
    const heatmapLaag = new HeatmapLayer({ source: meldingenSource, blur: 20, radius: 14, zIndex: 9, visible: false });
    heatmapLaagRef.current = heatmapLaag;

    const driftGroep = new LayerGroup({ layers: [], visible: false });
    driftGroepRef.current = driftGroep;

    const natura2000Laag = maakNatura2000Laag();
    natura2000LaagRef.current = natura2000Laag;

    const perceelLaag = maakPerceelgrenzenLaag();
    perceelLaagRef.current = perceelLaag;

    const gebruikerSource = new VectorSource();
    gebruikerSourceRef.current = gebruikerSource;
    // zIndex boven Natura2000 (4) en thuislocatie (3) — anders kan de
    // GPS-pin onder een Natura2000-polygoon "verdwijnen".
    const gebruikerLaag = new VectorLayer({ source: gebruikerSource, zIndex: 5 });

    const overlayEl = document.createElement('div');
    overlayEl.className = 'dashboard-kaart-popup';
    const overlay = new Overlay({ element: overlayEl, offset: [0, -12], positioning: 'bottom-center', stopEvent: true });
    overlayRef.current = overlay;

    const map = new Map({
      target: containerRef.current,
      // attribution-control staat linksonder (CSS-override in
      // DashboardKaart.css) zodat hij niet overlapt met de "Mijn
      // locatie"-knop rechtsonder (.dashboard-kaart-gps-knop).
      controls: defaultControls(),
      layers: [osmLaag, luchtLaag, natura2000Laag, perceelLaag, driftGroep, heatmapLaag, homeLaag, gebruikerLaag, clusterLaag],
      overlays: [overlay],
      view: new View({ center: fromLonLat([lng, lat]), zoom: 13 })
    });

    setHuidigeZoom(map.getView().getZoom());
    zoomListenerKeyRef.current = map.getView().on('change:resolution', () => {
      setHuidigeZoom(Math.round(map.getView().getZoom()));
    });

    map.on('click', (evt) => {
      overlay.setPosition(undefined);
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === clusterLaag });
      if (feature) {
        const onderliggend = feature.get('features');
        if (onderliggend.length === 1) {
          onMeldingSelecteren(onderliggend[0].get('melding').id);
          return;
        }
        overlayEl.innerHTML = onderliggend
          .slice(0, 12)
          .map((f) => {
            const m = f.get('melding');
            const d = new Date(m.timestamp_local);
            return `<div class="dashboard-kaart-popup-rij" data-id="${m.id}">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${m.type}</div>`;
          })
          .join('');
        overlayEl.querySelectorAll('.dashboard-kaart-popup-rij').forEach((rij) => {
          rij.onclick = () => { onMeldingSelecteren(rij.dataset.id); overlay.setPosition(undefined); };
        });
        overlay.setPosition(evt.coordinate);
        return;
      }

      // Natura2000-gebied alleen aanklikbaar zolang de laag zichtbaar is —
      // anders zou je per ongeluk op onzichtbare polygonen kunnen klikken.
      if (natura2000Laag.getVisible()) {
        const n2000Feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === natura2000Laag });
        if (n2000Feature) {
          overlayEl.innerHTML = natura2000PopupHtml(n2000Feature.getProperties());
          overlay.setPosition(evt.coordinate);
          return;
        }
      }

      // Perceelgrenzen alleen aanklikbaar zolang de laag zichtbaar is — net
      // als bij Natura2000 hierboven.
      if (perceelLaag.getVisible()) {
        const perceelFeature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === perceelLaag });
        if (perceelFeature) {
          overlayEl.innerHTML = perceelPopupHtml(perceelFeature.getProperties());
          overlay.setPosition(evt.coordinate);
        }
      }
    });

    mapRef.current = map;
    const invalidateTimer = setTimeout(() => map.updateSize(), 100);

    return () => {
      clearTimeout(invalidateTimer);
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
      meldingenSourceRef.current = null;
      driftGroepRef.current = null;
      luchtLaagRef.current = null;
      natura2000LaagRef.current = null;
      perceelLaagRef.current = null;
      gebruikerSourceRef.current = null;
      gebruikerMarkerRef.current = null;
      gebruikerCirkelRef.current = null;
      overlayRef.current = null;
      clusterLaagRef.current = null;
      heatmapLaagRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers + driftzones hertekenen bij gefilterde meldingen
  useEffect(() => {
    const meldingenSource = meldingenSourceRef.current;
    const driftGroep = driftGroepRef.current;
    if (!meldingenSource || !driftGroep) return;

    meldingenSource.clear();
    driftGroep.getLayers().clear();

    gefiltered.slice(0, MELDINGEN_KAART_LIMIET).forEach((m) => {
      if (!m.gps?.lat || !m.gps?.lng) return;
      if (Math.abs(m.gps.lat) < 0.01 && Math.abs(m.gps.lng) < 0.01) return;

      const feature = new Feature({ geometry: new Point(fromLonLat([m.gps.lng, m.gps.lat])) });
      feature.set('melding', m);
      meldingenSource.addFeature(feature);

      if (m.weather?.wind_dir != null && (m.type === 'spuitactiviteit' || m.type === 'drift')) {
        const laag = maakDriftZoneLayer(m);
        if (laag) driftGroep.getLayers().push(laag);
      }
    });
  }, [gefiltered]);

  // Plaatst (eerste keer) of verplaatst (daarna) de blauwe GPS-stip +
  // nauwkeurigheidscirkel op gebruikerSourceRef. Gedeeld door de live-pin-
  // watch hieronder, de gecachete-positie-bij-mount en de handmatige
  // "Mijn locatie"-knop (navigeerNaarGps) — zodat er maar één plek is die
  // de marker-features aanmaakt/bijwerkt.
  const plaatsOfUpdateGebruikerMarker = (coord, accuracy) => {
    const source = gebruikerSourceRef.current;
    if (!source) return;
    if (!gebruikerMarkerRef.current) {
      const marker = new Feature({ geometry: new Point(coord) });
      marker.setStyle(GEBRUIKER_STIJL);
      const cirkel = new Feature({ geometry: new CircleGeom(coord, accuracy || 0) });
      cirkel.setStyle(GEBRUIKER_CIRKEL_STIJL);
      source.addFeature(cirkel);
      source.addFeature(marker);
      gebruikerMarkerRef.current = marker;
      gebruikerCirkelRef.current = cirkel;
    } else {
      gebruikerMarkerRef.current.getGeometry().setCoordinates(coord);
      gebruikerCirkelRef.current.getGeometry().setCenterAndRadius(coord, accuracy || 0);
    }
  };

  // Eenmalige GPS-fix (geen continue watch) — gebruikt door de "Mijn
  // locatie"-knop én door de automatische centrering bij het laden van het
  // dashboard (zie de map-init effect hieronder). Los van de live-GPS-pin-
  // instelling: die blijft een bewuste opt-in voor continue locatietracking,
  // dit is alleen "waar ben ik nu".
  const navigeerNaarGps = () => {
    if (!navigator.geolocation) {
      setGpsFout('Geolocatie wordt niet ondersteund door deze browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsFout(null);
        slaGpsCacheOp(latitude, longitude, accuracy);
        const coord = fromLonLat([longitude, latitude]);
        plaatsOfUpdateGebruikerMarker(coord, accuracy);
        mapRef.current?.getView().animate({ center: coord, zoom: 15, duration: 500 });
      },
      (err) => {
        console.warn('[DashboardKaart] GPS niet beschikbaar:', err.message);
        setGpsFout('Kon GPS-locatie niet ophalen — controleer locatietoestemming in de browser');
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  // Live GPS-pin van de gebruiker — alleen actief als ingeschakeld via
  // Instellingen (DashboardGpsInstelling): continue watchPosition i.p.v. de
  // eenmalige fix van navigeerNaarGps(). Toont eerst de gecachete laatst
  // bekende positie (sneller op positie dan wachten op een verse fix) en
  // centreert de kaartweergave bij de EERSTE échte fix nog eens fijn op de
  // actuele GPS-positie (zie gpsGecentreerdRef) — daarna mag de gebruiker
  // zelf weer rondkijken zonder dat elke nieuwe GPS-update de kaart terugtrekt.
  useEffect(() => {
    if (!gpsAan || !navigator.geolocation) return;
    gpsGecentreerdRef.current = false;

    const cache = laadGpsCache();
    if (cache && gebruikerSourceRef.current) {
      const cacheCoord = fromLonLat([cache.lng, cache.lat]);
      plaatsOfUpdateGebruikerMarker(cacheCoord, cache.accuracy);
      mapRef.current?.getView().animate({ center: cacheCoord, zoom: 15, duration: 400 });
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!gebruikerSourceRef.current) return;
        setGpsFout(null);
        slaGpsCacheOp(latitude, longitude, accuracy);
        const coord = fromLonLat([longitude, latitude]);
        plaatsOfUpdateGebruikerMarker(coord, accuracy);
        if (!gpsGecentreerdRef.current && mapRef.current) {
          gpsGecentreerdRef.current = true;
          mapRef.current.getView().animate({ center: coord, zoom: 15, duration: 500 });
        }
      },
      (err) => {
        console.warn('[DashboardKaart] GPS niet beschikbaar:', err.message);
        setGpsFout('Kon GPS-locatie niet ophalen — controleer locatietoestemming in de browser');
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsAan]);

  // Automatisch navigeren naar de GPS-positie bij het laden van het
  // dashboard — onafhankelijk van de live-pin-instelling (die regelt alleen
  // of de stip daarna ZICHTBAAR/bijgewerkt blijft). Als gpsAan al aan staat
  // regelt de watch-effect hierboven het eerste centreren al, dus dan niet
  // dubbel een getCurrentPosition-aanvraag doen.
  useEffect(() => {
    if (gpsAan) return;
    navigeerNaarGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wisselLuchtfoto = () => {
    luchtLaagRef.current?.setVisible(!luchtAan);
    setLuchtAan(!luchtAan);
  };

  const wisselDriftLaag = () => {
    const volgende = !driftAan;
    setDriftAan(volgende);
    driftGroepRef.current?.setVisible(volgende);
  };

  const verversNatura2000 = () => {
    if (!mapRef.current || !natura2000LaagRef.current) return;
    const extent3857 = mapRef.current.getView().calculateExtent(mapRef.current.getSize());
    const extentLonLat = transformExtent(extent3857, 'EPSG:3857', 'EPSG:4326');
    vulNatura2000Laag(natura2000LaagRef.current, extentLonLat);
  };

  // BUG FIX: de laag werd alleen gevuld op het moment van aanzetten — bij
  // pannen/zoomen bleef de oude bbox staan. Nu een moveend-listener die
  // (alleen zolang de toggle aan staat) de laag bij elke kaartbeweging
  // opnieuw vult, en die weer opruimt bij uitzetten/unmounten.
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

  // PDOK-kadastrale-percelen — net als Natura2000 maar dan rond het huidige
  // kaartmidden i.p.v. de volledige extent (zie haalPerceelgrenzen() in
  // perceelLaag.js, die met een lat/lng + delta werkt, geen bbox).
  const verversPerceelgrenzen = () => {
    if (!mapRef.current || !perceelLaagRef.current) return;
    const center = mapRef.current.getView().getCenter();
    if (!center) return;
    const [lng, lat] = toLonLat(center);
    vulPerceelgrenzenLaag(perceelLaagRef.current, lat, lng);
  };

  const wisselPerceel = () => {
    const volgende = !perceelAan;
    setPerceelAan(volgende);
    perceelLaagRef.current?.setVisible(volgende);
    if (volgende) {
      verversPerceelgrenzen();
      if (mapRef.current && !perceelMoveendKeyRef.current) {
        perceelMoveendKeyRef.current = mapRef.current.on('moveend', verversPerceelgrenzen);
      }
    } else if (perceelMoveendKeyRef.current) {
      unByKey(perceelMoveendKeyRef.current);
      perceelMoveendKeyRef.current = null;
    }
  };

  // Heatmap en clustermarkers tonen dezelfde meldingenSource op twee
  // manieren — alternatieven, dus bij aanzetten van de ene gaat de andere uit.
  const wisselHeatmap = () => {
    const volgende = !heatmapAan;
    setHeatmapAan(volgende);
    heatmapLaagRef.current?.setVisible(volgende);
    clusterLaagRef.current?.setVisible(!volgende);
  };

  const melders = useMemo(
    () => [...new Set(gefiltered.map((m) => m.melder_email).filter(Boolean))],
    [gefiltered]
  );

  return (
    <div className="dashboard-kaart-wrap">
      <div className="dashboard-kaart-balk">
        <button type="button" className={`dashboard-kaart-toggle ${luchtAan ? 'actief-lucht' : ''}`} onClick={wisselLuchtfoto}>
          {luchtAan ? '🗺️ Kaart' : '🛰️ Luchtfoto'}
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
        {magHotspotsZien && (
          <button type="button" className={`dashboard-kaart-toggle ${heatmapAan ? 'actief-heatmap' : ''}`} onClick={wisselHeatmap}>
            🔥 Heatmap{heatmapAan ? ' aan' : ''}
          </button>
        )}
      </div>

      <div className="dashboard-kaart-kaart-houder">
        <div ref={containerRef} className="dashboard-kaart" />
        <span className="dashboard-kaart-zoom-badge">🔍 Zoom {huidigeZoom}</span>
        <button type="button" className="dashboard-kaart-gps-knop" onClick={navigeerNaarGps} title="Navigeer naar mijn huidige GPS-positie">
          📍
        </button>
      </div>

      <div className="dashboard-kaart-filterbalk">
        <select className="dashboard-kaart-select" value={jaarFilter} onChange={(e) => setJaarFilter(e.target.value)}>
          <option value="">Alle jaren</option>
          {jaren.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <select className="dashboard-kaart-select" value={maandFilter} onChange={(e) => setMaandFilter(e.target.value)}>
          {MAAND_OPTIES.map(([waarde, label]) => <option key={waarde} value={waarde}>{label}</option>)}
        </select>
        <select className="dashboard-kaart-select" value={dagFilter} onChange={(e) => setDagFilter(e.target.value)}>
          <option value="">Alle dagen</option>
          {DAG_OPTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {gefiltered.length > MELDINGEN_KAART_LIMIET && (
        <div className="dashboard-kaart-status" title="Verfijn het jaar/maand/dag-filter hierboven om meer specifieke meldingen te zien">
          ℹ️ {MELDINGEN_KAART_LIMIET} van {gefiltered.length} meldingen getoond op de kaart — verfijn je filter voor de rest.
        </div>
      )}

      {gpsFout && <div className="dashboard-kaart-status dashboard-kaart-status-fout">📍 {gpsFout}</div>}

      {melders.length > 0 && (
        <div className="dashboard-kaart-legenda">
          {melders.map((email) => (
            <span key={email} className="dashboard-kaart-legenda-item">
              <span className="dashboard-kaart-legenda-dot" style={{ border: `2px solid ${gebruikerKleur(email)}` }} />
              {melderCode(email)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
