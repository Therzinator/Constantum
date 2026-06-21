import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';

// Live neerslagradar (RainViewer, gratis publieke API zonder key) — relevant
// voor het dossier: regen kort na een spuitactiviteit kan de drift-/
// uitspoelingsbeoordeling beïnvloeden. Geen KNMI-key nodig (die wordt
// elders alleen gebruikt voor gecertificeerde station-historie, zie
// KNMIInstellingen.jsx); dit is een aparte, losse databron.
const FRAMES_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const TILE_SIZE = 256;
// Zoomniveau waarop de radartegels daadwerkelijk neerslag tonen — de
// brontegels hebben een resolutie van ~1km/pixel, dus verder inzoomen dan
// dit (zoals de standaard dashboard-zoom 13) toont alleen een uitvergroot,
// onscherp tegelblok i.p.v. herkenbare neerslagstructuur.
export const RADAR_ZOOM = 8;

export async function haalRadarFrames() {
  const res = await fetch(FRAMES_URL);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.radar?.past?.length) return null;
  return { host: data.host, past: data.radar.past, nowcast: data.radar.nowcast || [] };
}

export async function haalLaatsteRadarFrame() {
  const data = await haalRadarFrames();
  if (!data) return null;
  const laatste = data.past[data.past.length - 1];
  return { host: data.host, path: laatste.path, tijd: laatste.time };
}

export function maakRadarLaag() {
  return new TileLayer({ zIndex: 1, visible: false, opacity: 0.6 });
}

// kleurschema 2 = "universal blue", smoothing 1_1 — komt overeen met de
// standaard RainViewer-weergave die de meeste weer-apps gebruiken.
export function vulRadarLaag(laag, frame) {
  if (!frame) return;
  laag.setSource(
    new XYZ({
      url: `${frame.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
      attributions: '© RainViewer',
      crossOrigin: 'anonymous'
    })
  );
}

function lonLatNaarTilePixel(lon, lat, zoom) {
  const n = 2 ** zoom;
  const xFloat = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(xFloat);
  const y = Math.floor(yFloat);
  return { x, y, px: Math.floor((xFloat - x) * TILE_SIZE), py: Math.floor((yFloat - y) * TILE_SIZE) };
}

function laadTegelAlsContext(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(ctx);
    };
    img.onerror = () => reject(new Error('Radartegel kon niet laden'));
    img.src = url;
  });
}

// Leest per beschikbaar frame (verleden + nowcast-voorspelling, als
// RainViewer die voor deze regio levert) of er een gekleurde (= niet-
// transparante) radarpixel op (lat, lng) staat. RainViewer's nowcast is
// niet altijd gevuld — beschrijfNeerslagTijdlijn() valt dan terug op alleen
// het actuele beeld.
export async function leesNeerslagTijdlijn(lat, lng) {
  const data = await haalRadarFrames();
  if (!data) return null;
  const { x, y, px, py } = lonLatNaarTilePixel(lng, lat, RADAR_ZOOM);
  const framesMetType = [
    ...data.past.map((f) => ({ ...f, voorspeld: false })),
    ...data.nowcast.map((f) => ({ ...f, voorspeld: true }))
  ];

  const resultaten = [];
  for (const frame of framesMetType) {
    try {
      const ctx = await laadTegelAlsContext(`${data.host}${frame.path}/${TILE_SIZE}/${RADAR_ZOOM}/${x}/${y}/2/1_1.png`);
      const [, , , alpha] = ctx.getImageData(px, py, 1, 1).data;
      resultaten.push({ tijd: frame.time, voorspeld: frame.voorspeld, neerslag: alpha > 10 });
    } catch {
      resultaten.push({ tijd: frame.time, voorspeld: frame.voorspeld, neerslag: false, onbekend: true });
    }
  }
  return resultaten;
}

function formatTijd(unixSeconden) {
  return new Date(unixSeconden * 1000).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

// Vertaalt de tijdlijn van leesNeerslagTijdlijn() naar één leesbare regel
// voor de popup.
export function beschrijfNeerslagTijdlijn(resultaten) {
  if (!resultaten?.length) return 'Geen radardata beschikbaar voor deze locatie.';

  const nu = resultaten.filter((r) => !r.voorspeld);
  const voorspeld = resultaten.filter((r) => r.voorspeld);
  const huidig = nu[nu.length - 1];

  if (huidig?.neerslag) {
    const droogVanaf = voorspeld.find((r) => !r.neerslag);
    return droogVanaf
      ? `🌧️ Het regent nu op deze locatie — naar verwachting droog vanaf ${formatTijd(droogVanaf.tijd)}.`
      : '🌧️ Het regent nu op deze locatie.';
  }

  if (!voorspeld.length) {
    return '☀️ Geen neerslag op de radar — geen voorspelling beschikbaar voor deze regio.';
  }

  const eersteRegen = voorspeld.find((r) => r.neerslag);
  if (!eersteRegen) {
    const minutenVooruit = Math.round((voorspeld[voorspeld.length - 1].tijd - huidig.tijd) / 60);
    return `☀️ Geen neerslag verwacht op deze locatie in de komende ${minutenVooruit} minuten.`;
  }
  const minutenTot = Math.round((eersteRegen.tijd - huidig.tijd) / 60);
  return `🌧️ Neerslag verwacht op deze locatie vanaf ${formatTijd(eersteRegen.tijd)} (over ${minutenTot} minuten).`;
}
