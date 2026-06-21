export const TILE_GROOTTE = 256;

// Standaard slippy-map tile/pixel-berekening (zelfde wiskunde die eerder in
// radarLaag.js stond voor de RainViewer-pixelcheck) — hier gebruikt om een
// los OSM-tegeltje te positioneren onder een vast puntje in een klein
// kaartje (zie MeldingMiniKaart.jsx).
export function lonLatNaarTileEnPixel(lon, lat, zoom) {
  const n = 2 ** zoom;
  const xFloat = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(xFloat);
  const y = Math.floor(yFloat);
  return { x, y, px: Math.floor((xFloat - x) * TILE_GROOTTE), py: Math.floor((yFloat - y) * TILE_GROOTTE) };
}
