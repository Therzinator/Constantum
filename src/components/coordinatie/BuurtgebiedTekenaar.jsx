import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import { Point } from 'ol/geom.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Cluster from 'ol/source/Cluster.js';
import Draw from 'ol/interaction/Draw.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { getArea } from 'ol/sphere.js';
import { fromLonLat } from 'ol/proj.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Text from 'ol/style/Text.js';
import 'ol/ol.css';
import { maakOsmLaag } from '../../lib/ol/lagen.js';
import { haalAlleEntriesVoorExportAdmin } from '../../lib/supabase/admin.js';
import { laadBijlagenVanSupabase } from '../../lib/supabase/bijlagen.js';
import { entryNaarExportMelding } from '../../lib/meldingen/regioExport.js';
import { meldingenNaarCSV } from '../../lib/export/csv.js';
import { downloadFile } from '../../lib/export/download.js';
import { genereerDossierHTML, openDossierPDF } from '../../lib/export/pdf.js';
import { isAdmin } from '../../lib/rollen.js';
import './BuurtgebiedTekenaar.css';

const POLYGOON_STIJL = new Style({
  stroke: new Stroke({ color: '#00d4aa', width: 2 }),
  fill: new Fill({ color: 'rgba(0,212,170,0.12)' })
});

const TYPE_KLEUREN = {
  spuitactiviteit: '#f59e0b',
  drift: '#3b82f6',
  geur: '#8b5cf6',
  gezondheid: '#ef4444',
  geluid: '#f97316',
  overig: '#6b7280'
};

// Eenvoudigere variant van clusterStijl() uit DashboardKaart.jsx — alleen
// kleur per type + aantal-badge, geen datumlabel/klik-popup. Hier gaat het
// alleen om "waar zitten de meldingen" om een gebied goed te kunnen
// aftekenen, niet om individuele meldingen te selecteren.
function clusterStijl(feature) {
  const onderliggend = feature.get('features');
  const aantal = onderliggend.length;
  if (aantal === 1) {
    const m = onderliggend[0].get('melding');
    const kleur = TYPE_KLEUREN[m.type] || '#6b7280';
    return new Style({
      image: new CircleStyle({ radius: 5, fill: new Fill({ color: kleur }), stroke: new Stroke({ color: '#fff', width: 2 }) })
    });
  }
  return new Style({
    image: new CircleStyle({ radius: 12, fill: new Fill({ color: 'rgba(0,212,170,0.85)' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
    text: new Text({ text: String(aantal), font: 'bold 11px monospace', fill: new Fill({ color: '#0d1520' }) })
  });
}

// Coordinatie & Admin systeem — tool om een buurtgebied als polygoon af te
// bakenen (i.p.v. alleen op postcodegebied te filteren, zoals
// BuurtrapportGenerator.jsx doet). Toont de (provincie/gemeente-gefilterde)
// meldingen geclusterd op de kaart, zodat je ziet waar ze zitten vóór je
// tekent — voorheen een lege kaart, je tekende dan "blind". Na het tekenen
// kan het gebied geëxporteerd worden: alle meldingen binnen de polygoon als
// CSV-download + gebundeld in het bestaande Dossier-PDF-formaat. Die export
// (individuele meldingen incl. PII van andere melders) is sinds 2026-06-22
// admin-only (zie DECISIONS.md) — een coordinator ziet de kaart en kan het
// gebied tekenen/als GeoJSON exporteren, maar niet de melding-CSV/PDF.
export function BuurtgebiedTekenaar({ thuislocatie, meldingen, user, gebruikerRol }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const sourceRef = useRef(null);
  const drawRef = useRef(null);
  const meldingenSourceRef = useRef(null);
  const polygoonGeomRef = useRef(null);
  const [oppervlakteHa, setOppervlakteHa] = useState(null);
  const [geojson, setGeojson] = useState(null);
  const [csvBezig, setCsvBezig] = useState(false);
  const [csvStatus, setCsvStatus] = useState(null);
  const [pdfBezig, setPdfBezig] = useState(false);
  const [pdfStatus, setPdfStatus] = useState(null);
  const magExporteren = isAdmin(gebruikerRol);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const lat = thuislocatie?.lat ?? 52.3676;
    const lng = thuislocatie?.lng ?? 5.2006;

    const source = new VectorSource();
    sourceRef.current = source;
    const vectorLaag = new VectorLayer({ source, style: POLYGOON_STIJL, zIndex: 10 });

    const meldingenSource = new VectorSource();
    meldingenSourceRef.current = meldingenSource;
    const clusterSource = new Cluster({ source: meldingenSource, distance: 32 });
    const clusterLaag = new VectorLayer({ source: clusterSource, style: clusterStijl, zIndex: 5 });

    const map = new Map({
      target: containerRef.current,
      layers: [maakOsmLaag(), clusterLaag, vectorLaag],
      view: new View({ center: fromLonLat([lng, lat]), zoom: 13 })
    });

    const draw = new Draw({ source, type: 'Polygon' });
    draw.on('drawstart', () => {
      source.clear();
      polygoonGeomRef.current = null;
      setGeojson(null);
      setOppervlakteHa(null);
      setCsvStatus(null);
      setPdfStatus(null);
    });
    draw.on('drawend', (evt) => {
      const geom = evt.feature.getGeometry();
      polygoonGeomRef.current = geom;
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
      meldingenSourceRef.current = null;
      drawRef.current = null;
      polygoonGeomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clustermarkers opnieuw tekenen zodra de meegegeven set wijzigt (bv.
  // door het provincie/gemeente-filter op CoordinatiePage).
  useEffect(() => {
    const source = meldingenSourceRef.current;
    if (!source) return;
    source.clear();
    (meldingen || []).forEach((m) => {
      if (m.gps_lat == null || m.gps_lng == null) return;
      const feature = new Feature({ geometry: new Point(fromLonLat([m.gps_lng, m.gps_lat])) });
      feature.set('melding', m);
      source.addFeature(feature);
    });
  }, [meldingen]);

  const wissen = () => {
    sourceRef.current?.clear();
    polygoonGeomRef.current = null;
    setGeojson(null);
    setOppervlakteHa(null);
    setCsvStatus(null);
    setPdfStatus(null);
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

  // Filtert ALLE meldingen (volledig admin-zicht, ongeacht opt_in_buurt —
  // zie haalAlleEntriesVoorExportAdmin(); dit is geen anonieme aggregatie
  // zoals BuurtrapportGenerator.jsx, maar het bestaande, al toegestane
  // admin/coordinator-zicht op individuele meldingen) op het getekende
  // gebied en haalt per melding de bijlagen op. Gedeeld door CSV-export en
  // Dossier-PDF — die zijn twee losse acties, geen vaste volgorde van
  // CSV-download gevolgd door PDF-opening meer. Foto's worden per melding
  // apart opgehaald via laadBijlagenVanSupabase(); als de huidige
  // gebruiker daar voor andermans meldingen geen toegang tot heeft
  // (storage/attachments-RLS, niet in een migratie vastgelegd — zie
  // root-CLAUDE.md-opmerking over schema-gaten) faalt dat per melding
  // stilletjes terug naar een lege bijlagenlijst, niet de hele actie.
  const haalMeldingenInGebied = async (setStatus) => {
    setStatus('Meldingen ophalen...');
    const ruweEntries = await haalAlleEntriesVoorExportAdmin();
    const binnenGebied = ruweEntries.filter((e) =>
      e.gps_lat != null && e.gps_lng != null &&
      polygoonGeomRef.current.intersectsCoordinate(fromLonLat([e.gps_lng, e.gps_lat]))
    );
    if (!binnenGebied.length) return [];

    const meldingenVoorExport = binnenGebied.map(entryNaarExportMelding);
    for (let i = 0; i < meldingenVoorExport.length; i++) {
      setStatus(`Bijlagen ophalen... ${i + 1}/${meldingenVoorExport.length}`);
      meldingenVoorExport[i].bestanden = await laadBijlagenVanSupabase(meldingenVoorExport[i].id, user).catch(() => []);
    }
    return meldingenVoorExport;
  };

  const handleExporteerCSV = async () => {
    if (!polygoonGeomRef.current) return;
    setCsvBezig(true);
    setCsvStatus(null);
    try {
      const meldingenVoorExport = await haalMeldingenInGebied(setCsvStatus);
      if (!meldingenVoorExport.length) {
        setCsvStatus('Geen meldingen gevonden binnen het getekende gebied');
        return;
      }
      downloadFile(
        meldingenNaarCSV(meldingenVoorExport),
        `buurtgebied_export_${new Date().toISOString().split('T')[0]}.csv`,
        'text/csv'
      );
      setCsvStatus(`Klaar — ${meldingenVoorExport.length} meldingen als CSV gedownload`);
    } catch (err) {
      setCsvStatus(`Mislukt: ${err.message}`);
    } finally {
      setCsvBezig(false);
    }
  };

  const handleSamenstellenDossier = async () => {
    if (!polygoonGeomRef.current) return;
    setPdfBezig(true);
    setPdfStatus(null);
    try {
      const meldingenVoorExport = await haalMeldingenInGebied(setPdfStatus);
      if (!meldingenVoorExport.length) {
        setPdfStatus('Geen meldingen gevonden binnen het getekende gebied');
        return;
      }
      setPdfStatus('Dossier-PDF openen...');
      const html = await genereerDossierHTML(meldingenVoorExport, 'Buurtgebied (getekend)');
      openDossierPDF(html);
      setPdfStatus(`Klaar — Dossier-PDF geopend met ${meldingenVoorExport.length} meldingen`);
    } catch (err) {
      setPdfStatus(`Mislukt: ${err.message}`);
    } finally {
      setPdfBezig(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="section-label mb-3">🖊️ Buurtgebied tekenen</div>
      <div className="export-card-beschrijving mb-3">
        Teken een polygoon om een buurtgebied af te bakenen — de kaart toont
        alle (gefilterde) meldingen geclusterd, zodat je ziet waar ze zitten
        vóórdat je het gebied aftekent. Klik om punten te plaatsen,
        dubbelklik om af te ronden.
      </div>
      <div ref={containerRef} className="buurtgebied-tekenaar-kaart" />
      <div className="buurtgebied-tekenaar-balk">
        <button type="button" className="btn-outline px-3 py-1" onClick={wissen}>🗑️ Wissen</button>
        <button type="button" className="btn-outline px-3 py-1" disabled={!geojson} onClick={downloadGeojson}>
          ⬇️ Exporteer GeoJSON
        </button>
        {magExporteren && (
          <>
            <button type="button" className="btn-outline px-3 py-1" disabled={!geojson || csvBezig} onClick={handleExporteerCSV}>
              {csvBezig ? '⏳ Bezig...' : '📄 Exporteer meldingen als CSV'}
            </button>
            <button type="button" className="btn-outline px-3 py-1" disabled={!geojson || pdfBezig} onClick={handleSamenstellenDossier}>
              {pdfBezig ? '⏳ Bezig...' : '📦 Stel Dossier-PDF samen'}
            </button>
          </>
        )}
        {oppervlakteHa != null && <span className="buurtgebied-tekenaar-oppervlakte">≈ {oppervlakteHa} ha</span>}
      </div>
      {!magExporteren && (
        <div className="export-card-beschrijving mt-2">
          Meldingen-export (CSV/Dossier-PDF) van een getekend gebied is
          admin-only — vraag de beheerder om dit dossier samen te stellen.
        </div>
      )}
      {csvStatus && <div className="export-card-beschrijving mt-2">{csvStatus}</div>}
      {pdfStatus && <div className="export-card-beschrijving mt-2">{pdfStatus}</div>}
    </div>
  );
}
