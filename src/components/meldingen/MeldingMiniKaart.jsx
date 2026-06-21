import { lonLatNaarTileEnPixel, TILE_GROOTTE } from '../../lib/geo/tiles.js';
import './MeldingMiniKaart.css';

const ZOOM = 15;
const KAARTJE_GROOTTE = 56;

// Eén los OSM-tegeltje i.p.v. een volwaardige OpenLayers-kaart per kaartje —
// "Recente meldingen" toont tot 5 van deze kaartjes tegelijk, dus een eigen
// Map-instantie per kaartje zou onnodig zwaar zijn voor zo'n klein beeld.
// Beperking: bij een puntje vlak bij een tegelrand toont het kaartje aan
// die kant geen buurtegel (gewoon de achtergrondkleur) — voor een 56px
// thumbnail een acceptabele afwijking t.o.v. een volledige stitch.
function osmSubdomein(x, y) {
  return 'abc'[(x + y) % 3];
}

export function MeldingMiniKaart({ lat, lng }) {
  if (lat == null || lng == null) return null;

  const { x, y, px, py } = lonLatNaarTileEnPixel(lng, lat, ZOOM);
  const tileUrl = `https://${osmSubdomein(x, y)}.tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`;
  const positieX = -(px - KAARTJE_GROOTTE / 2);
  const positieY = -(py - KAARTJE_GROOTTE / 2);

  return (
    <div
      className="melding-mini-kaart"
      style={{ backgroundImage: `url(${tileUrl})`, backgroundSize: `${TILE_GROOTTE}px ${TILE_GROOTTE}px`, backgroundPosition: `${positieX}px ${positieY}px` }}
      title="Locatie van deze melding"
    >
      <span className="melding-mini-kaart-pin" />
    </div>
  );
}
