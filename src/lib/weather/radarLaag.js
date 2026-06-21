import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';

// Live neerslagradar (RainViewer, gratis publieke API zonder key) — relevant
// voor het dossier: regen kort na een spuitactiviteit kan de drift-/
// uitspoelingsbeoordeling beïnvloeden. Geen KNMI-key nodig (die wordt
// elders alleen gebruikt voor gecertificeerde station-historie, zie
// KNMIInstellingen.jsx); dit is een aparte, losse databron.
//
// Sinds RainViewer's API-transitie van 1 januari 2026 (gratis publieke tier,
// zie rainviewer.com/api/transition-faq.html) is het maximale tegel-
// zoomniveau verlaagd naar 7 (was hoger) én is nowcast/voorspellingsdata
// volledig komen te vervallen — de publieke API levert nu alleen nog
// historische tegels (2 uur terug, per 10 minuten). Vandaar RADAR_ZOOM=7
// (verder inzoomen gaf een tegel met de letterlijke tekst "Zoom level not
// supported" i.p.v. neerslagdata) en de 3-uursverwachting hieronder via
// buienradarNowcast.js i.p.v. via RainViewer.
const FRAMES_URL = 'https://api.rainviewer.com/public/weather-maps.json';
export const RADAR_ZOOM = 7;
// Zoomniveau voor de kaartweergave zodra de radar-toggle aangaat — los van
// RADAR_ZOOM (de harde tegel-maxZoom hierboven). Provincieniveau + een
// beetje extra context, i.p.v. de eerdere RADAR_ZOOM=7 die nog op de oude
// (hogere-resolutie) RainViewer-module was afgestemd en op een veel te
// grof landsniveau uitzoomde.
export const RADAR_WEERGAVE_ZOOM = 9;

export async function haalRadarFrames() {
  const res = await fetch(FRAMES_URL);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.radar?.past?.length) return null;
  return { host: data.host, past: data.radar.past };
}

// Alle beschikbare historische frames (laatste 2 uur, per 10 minuten) als
// los af te spelen reeks — voor de "wolken in beweging"-animatie op het
// dashboard (zie DashboardKaart.jsx). RainViewer's gratis tier levert geen
// toekomstige/nowcast-frames meer (zie module-comment hierboven), dus dit
// toont de werkelijke beweging van de afgelopen 2 uur, niet een voorspelling.
export async function haalRadarAnimatieFrames() {
  const data = await haalRadarFrames();
  if (!data) return [];
  return data.past.map((f) => ({ host: data.host, path: f.path, tijd: f.time }));
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
      crossOrigin: 'anonymous',
      // Hard begrenzen op RADAR_ZOOM: zonder maxZoom blijft OL bij verder
      // inzoomen (bv. handmatig na het aanzetten van de toggle) tegels op
      // het diepere zoomniveau aanvragen, en die geeft RainViewer terug als
      // een tegel met de tekst "Zoom level not supported" i.p.v. een 404 —
      // met maxZoom hergebruikt OL i.p.v. dat de tegel van zoom 7 uitvergroot.
      maxZoom: RADAR_ZOOM
    })
  );
}
