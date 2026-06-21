import { useEffect, useRef } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import { Point } from 'ol/geom.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import 'ol/ol.css';
import { maakDriftZoneLayer } from '../../lib/drift/driftzone.js';
import { maakOsmLaag } from '../../lib/ol/lagen.js';

// React-versie van de mini-kaart in showMeldingDetail() / toonDriftZoneModal()
// uit docs/index.html. Toont alleen een locatiepin als er geen winddata is.
//
// Gemigreerd van Leaflet naar OpenLayers 10.
export function DriftZoneKaart({ melding, hoogte = 200 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !melding.gps?.lat || !melding.gps?.lng) return;

    const center = fromLonLat([melding.gps.lng, melding.gps.lat]);
    const osmLaag = maakOsmLaag();

    const driftLaag = maakDriftZoneLayer(melding);
    let fallbackLaag = null;
    if (!driftLaag) {
      const source = new VectorSource();
      const feature = new Feature({ geometry: new Point(center) });
      feature.setStyle(
        new Style({ image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#f59e0b' }), stroke: new Stroke({ color: '#fff', width: 2 }) }) })
      );
      source.addFeature(feature);
      fallbackLaag = new VectorLayer({ source });
    }

    const map = new Map({
      target: containerRef.current,
      controls: [],
      layers: [osmLaag, driftLaag || fallbackLaag],
      view: new View({ center, zoom: 16 })
    });

    mapRef.current = map;
    setTimeout(() => map.updateSize(), 100);

    return () => {
      map.setTarget(null);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [melding.id]);

  if (!melding.gps?.lat || !melding.gps?.lng) return null;

  return <div ref={containerRef} style={{ height: hoogte, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }} />;
}
