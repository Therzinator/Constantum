import { lonLatNaarTileEnPixel, TILE_GROOTTE } from '../../lib/geo/tiles.js';
import './MeldingMiniKaart.css';

const ZOOM = 15;
const KAARTJE_GROOTTE = 224;

// Eén los OSM-tegeltje i.p.v. een volwaardige OpenLayers-kaart per kaartje —
// "Recente meldingen" toont tot 5 van deze kaartjes tegelijk, dus een eigen
// Map-instantie per kaartje zou onnodig zwaar zijn voor zo'n klein beeld.
// Beperking: bij een puntje vlak bij een tegelrand toont het kaartje aan
// die kant geen buurtegel (gewoon de achtergrondkleur) — bij 224px (bijna
// de volledige 256px-tegel) komt dat nog minder vaak voor dan bij de
// eerdere 112px, maar nog steeds een acceptabele afwijking t.o.v. een
// volledige stitch. KAARTJE_GROOTTE moet gelijk blijven aan de breedte/
// hoogte in .melding-mini-kaart (MeldingMiniKaart.css) — anders raakt de
// centrering van de achtergrondtegel scheef.
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
