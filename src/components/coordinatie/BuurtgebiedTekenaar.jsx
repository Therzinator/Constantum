import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Draw from 'ol/interaction/Draw.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { getArea } from 'ol/sphere.js';
import { fromLonLat } from 'ol/proj.js';
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import 'ol/ol.css';
import { maakOsmLaag } from '../../lib/ol/lagen.js';
import './BuurtgebiedTekenaar.css';

const POLYGOON_STIJL = new Style({
  stroke: new Stroke({ color: '#00d4aa', width: 2 }),
  fill: new Fill({ color: 'rgba(0,212,170,0.12)' })
});

// Coordinatie & Admin systeem — losstaande tool om een buurtgebied als
// polygoon te tekenen (i.p.v. alleen op postcodegebied te filteren, zoals
// BuurtrapportGenerator.jsx doet). Exporteert de geometrie als GeoJSON
// (EPSG:4326) zodat die later als geometrische filter gebruikt kan worden.
export function BuurtgebiedTekenaar({ thuislocatie }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const sourceRef = useRef(null);
  const drawRef = useRef(null);
  const [oppervlakteHa, setOppervlakteHa] = useState(null);
  const [geojson, setGeojson] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const lat = thuislocatie?.lat ?? 52.3676;
    const lng = thuislocatie?.lng ?? 5.2006;

    const source = new VectorSource();
    sourceRef.current = source;
    const vectorLaag = new VectorLayer({ source, style: POLYGOON_STIJL });

    const map = new Map({
      target: containerRef.current,
      layers: [maakOsmLaag(), vectorLaag],
      view: new View({ center: fromLonLat([lng, lat]), zoom: 13 })
    });

    const draw = new Draw({ source, type: 'Polygon' });
    draw.on('drawstart', () => {
      source.clear();
      setGeojson(null);
      setOppervlakteHa(null);
    });
    draw.on('drawend', (evt) => {
      const geom = evt.feature.getGeometry();
      setOppervlakteHa(Math.round(getArea(geom, { projection: 'EPSG:3857' })) / 10000);
      const format = new GeoJSON();
      const obj = format.writeFeatureObject(evt.feature, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
      setGeojson(JSON.stringify(obj, null, 2));
    });
    map.addInteraction(draw);
    drawRef.current = draw;

    mapRef.current = map;
    setTimeout(() => map.updateSize(), 100);

    return () => {
      map.setTarget(null);
      mapRef.current = null;
      sourceRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wissen = () => {
    sourceRef.current?.clear();
    setGeojson(null);
    setOppervlakteHa(null);
  };

  const downloadGeojson = () => {
    if (!geojson) return;
    const blob = new Blob([geojson], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buurtgebied-${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-4">
      <div className="section-label mb-3">🖊️ Buurtgebied tekenen</div>
      <div className="export-card-beschrijving mb-3">
        Teken een polygoon om een buurtgebied af te bakenen (i.p.v. alleen op
        postcodegebied te filteren). Klik om punten te plaatsen, dubbelklik om
        af te ronden.
      </div>
      <div ref={containerRef} className="buurtgebied-tekenaar-kaart" />
      <div className="buurtgebied-tekenaar-balk">
        <button type="button" className="btn-outline px-3 py-1" onClick={wissen}>🗑️ Wissen</button>
        <button type="button" className="btn-outline px-3 py-1" disabled={!geojson} onClick={downloadGeojson}>
          ⬇️ Exporteer GeoJSON
        </button>
        {oppervlakteHa != null && <span className="buurtgebied-tekenaar-oppervlakte">≈ {oppervlakteHa} ha</span>}
      </div>
    </div>
  );
}
