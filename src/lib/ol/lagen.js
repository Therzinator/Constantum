import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';

const LUCHTFOTO_URL =
  'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=Actueel_ortho25&STYLE=default&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png';

// Komt overeen met de OSM-laag uit de Leaflet-versie — XYZ-source i.p.v.
// Leaflet's tileLayer, zelfde {z}/{x}/{y}-template.
export function maakOsmLaag() {
  return new TileLayer({
    className: 'ol-layer-basis',
    source: new XYZ({
      url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attributions: '© OpenStreetMap',
      maxZoom: 19
    })
  });
}

// PDOK-luchtfoto via WMTS — XYZ-source met de RD-projectie-vrije
// EPSG:3857-tilematrixset, zodat geen apart WMTS-tilegrid nodig is.
// className: 'ol-layer-basis' — OL tekent tile-lagen op een eigen <canvas>
// (geen losse <img>-elementen), dus de dark-theme-dimfilter in
// LocatieKaart.css moet die canvas via een eigen classnaam kunnen
// targetten zonder ook de marker-/vectorlagen te raken.
export function maakLuchtfotoLaag() {
  return new TileLayer({
    className: 'ol-layer-basis',
    source: new XYZ({
      url: LUCHTFOTO_URL,
      attributions: '© PDOK Luchtfoto',
      maxZoom: 19
    }),
    visible: false
  });
}

// Vervangt Leaflet's L.divIcon-bolletjes (homeIcon/meldIcon/gebruikerIcon) —
// CircleStyle benadert dezelfde gekleurde stip met witte rand. Geen
// box-shadow-equivalent in canvas-stijlen, dat is een acceptabel visueel
// verschil t.o.v. de Leaflet-versie.
export function maakPuntStijl(kleur, straal = 7, randKleur = '#ffffff', randBreedte = 3) {
  return new Style({
    image: new CircleStyle({
      radius: straal,
      fill: new Fill({ color: kleur }),
      stroke: new Stroke({ color: randKleur, width: randBreedte })
    })
  });
}
