import proj4 from 'proj4';
import { register } from 'ol/proj/proj4.js';

// PDOK-diensten (kadastrale kaart, Natura2000) leveren WFS-features doorgaans
// in EPSG:28992 (RD New) — de Nederlandse rijksdriehoeksprojectie. OpenLayers
// kent dit CRS niet standaard, dus registreren we de proj4-definitie zodat
// ol/format/GeoJSON met dataProjection: 'EPSG:28992' kan reprojecteren naar
// de kaart-projectie (EPSG:3857, via WGS84/EPSG:4326).
const RD_NEW_DEF =
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 ' +
  '+k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel ' +
  '+towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';

let geregistreerd = false;

// Eenmalige registratie — idempotent, mag gerust meerdere keren aangeroepen worden.
export function registreerRDNew() {
  if (geregistreerd) return;
  proj4.defs('EPSG:28992', RD_NEW_DEF);
  register(proj4);
  geregistreerd = true;
}
