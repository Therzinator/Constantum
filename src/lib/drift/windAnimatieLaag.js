import Feature from 'ol/Feature.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Point } from 'ol/geom.js';
import { fromLonLat } from 'ol/proj.js';
import Icon from 'ol/style/Icon.js';
import Style from 'ol/style/Style.js';

// Geanimeerde windvector-laag — toont per opgegeven punt (meldingspin) een
// stroompje van pijltjes die in de afdrift-richting bewegen (windDir + 180°,
// zelfde conventie als driftKegel() in driftzone.js: wind_dir is de richting
// WAARVANDAAN de wind komt, de drift beweegt de andere kant op). Gebruikt op
// de formulier-kaart (LocatieKaart.jsx) bij de actieve meldingspin.
const PIJL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
  '<polygon points="10,1 14,13 10,10 6,13" fill="#00d4aa"/></svg>';
const PIJL_SRC = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(PIJL_SVG);

const DEELTJES_PER_PUNT = 6;
const RADIUS_M = 150;

function pijlStijl(rotatieRad) {
  return new Style({ image: new Icon({ src: PIJL_SRC, rotation: rotatieRad, rotateWithView: false }) });
}

export function maakWindAnimatieLaag() {
  return new VectorLayer({ source: new VectorSource(), zIndex: 9, visible: false });
}

// punten: [{ lat, lng, windDir, windSpeed }] — elk deeltje onthoudt zijn
// eigen middelpunt/driftrichting/snelheid als feature-property, zodat de
// animatieloop ze onafhankelijk van elkaar kan verplaatsen.
export function vulWindAnimatieDeeltjes(laag, punten) {
  const source = laag.getSource();
  source.clear();
  punten.forEach(({ lat, lng, windDir, windSpeed }) => {
    if (lat == null || lng == null || windDir == null) return;

    const driftRichtingRad = (((windDir + 180) % 360) * Math.PI) / 180;
    const snelheidMs = (windSpeed || 5) / 3.6;
    const middelpunt = fromLonLat([lng, lat]);
    const stijl = pijlStijl(driftRichtingRad);

    for (let i = 0; i < DEELTJES_PER_PUNT; i++) {
      const hoek = Math.random() * Math.PI * 2;
      const straal = Math.random() * RADIUS_M;
      const feature = new Feature({
        geometry: new Point([middelpunt[0] + Math.cos(hoek) * straal, middelpunt[1] + Math.sin(hoek) * straal])
      });
      feature.setStyle(stijl);
      feature.set('middelpunt', middelpunt);
      feature.set('driftRichtingRad', driftRichtingRad);
      feature.set('snelheidMs', snelheidMs);
      feature.set('afstand', straal);
      source.addFeature(feature);
    }
  });
}

// Start de requestAnimationFrame-loop en geeft een stopfunctie terug —
// bewust geen module-singleton, zodat meerdere kaartinstanties (bv. bij
// hot-reload) elkaars animatie niet kunnen overschrijven.
export function startWindAnimatie(map, laag) {
  let rafId = null;
  let laatsteTijd = null;

  const frame = (tijd) => {
    const source = laag.getSource();
    if (laatsteTijd == null) laatsteTijd = tijd;
    const deltaS = Math.min((tijd - laatsteTijd) / 1000, 0.1);
    laatsteTijd = tijd;

    source.getFeatures().forEach((feature) => {
      const geom = feature.getGeometry();
      const [x, y] = geom.getCoordinates();
      const richtingRad = feature.get('driftRichtingRad');
      const snelheidMs = feature.get('snelheidMs');
      const verplaatsing = Math.max(snelheidMs, 1) * 6 * deltaS;
      const afstand = (feature.get('afstand') || 0) + verplaatsing;
      const middelpunt = feature.get('middelpunt');

      if (afstand > RADIUS_M) {
        const hoek = Math.random() * Math.PI * 2;
        const straal = Math.random() * RADIUS_M * 0.3;
        geom.setCoordinates([middelpunt[0] + Math.cos(hoek) * straal, middelpunt[1] + Math.sin(hoek) * straal]);
        feature.set('afstand', straal);
      } else {
        geom.setCoordinates([x + Math.sin(richtingRad) * verplaatsing, y + Math.cos(richtingRad) * verplaatsing]);
        feature.set('afstand', afstand);
      }
    });

    map.render();
    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}
