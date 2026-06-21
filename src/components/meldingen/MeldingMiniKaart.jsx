import { lonLatNaarTileEnPixel, TILE_GROOTTE } from '../../lib/geo/tiles.js';
import './MeldingMiniKaart.css';

const ZOOM = 14;
const KAARTJE_GROOTTE = 157; // 30% kleiner dan de eerdere 224px
// De 256px-tegel 2x uitvergroot getoond — geeft genoeg "buffer" om de
// box te kunnen vullen na het clampen hieronder, zonder de tegel zo ver
// te moeten uitrekken dat hij onscherp wordt.
const TEGEL_SCHAAL = 2;
const TEGEL_WEERGAVEGROOTTE = TILE_GROOTTE * TEGEL_SCHAAL;

// Eén los OSM-tegeltje i.p.v. een volwaardige OpenLayers-kaart per kaartje —
// "Recente meldingen" toont tot 5 van deze kaartjes tegelijk, dus een eigen
// Map-instantie per kaartje zou onnodig zwaar zijn voor zo'n klein beeld.
// KAARTJE_GROOTTE moet gelijk blijven aan de breedte/hoogte in
// .melding-mini-kaart (MeldingMiniKaart.css) — anders raakt de centrering
// van de achtergrondtegel scheef.
function osmSubdomein(x, y) {
  return 'abc'[(x + y) % 3];
}

// `icoon` is de emoji van het waarneming-type (zie TYPE_LABEL in
// MeldingCard.jsx) — vervangt de eerdere generieke oranje pin-druppel,
// zodat je het type meldingen al op het kaartje zelf herkent.
export function MeldingMiniKaart({ lat, lng, icoon = '📍' }) {
  if (lat == null || lng == null) return null;

  const { x, y, px, py } = lonLatNaarTileEnPixel(lng, lat, ZOOM);
  const tileUrl = `https://${osmSubdomein(x, y)}.tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`;
  // px/py liggen in het ongeschaalde 0-256-bereik — vermenigvuldigen met
  // TEGEL_SCHAAL zodat de positie van het punt meeschaalt met de grotere
  // weergavegrootte van de tegel.
  const ongeclamptX = -(px * TEGEL_SCHAAL - KAARTJE_GROOTTE / 2);
  const ongeclamptY = -(py * TEGEL_SCHAAL - KAARTJE_GROOTTE / 2);

  // Clampen i.p.v. alleen vergroten: zonder clamp bleef bij een punt dicht
  // bij de tegelrand altijd een lege rand mogelijk, hoe groot TEGEL_SCHAAL
  // ook werd (vergroten verkleint de kans, het sluit hem niet uit). Door
  // de tegelpositie te begrenzen op het bereik waarbinnen hij de hele
  // KAARTJE_GROOTTE-box blijft bedekken, is een lege rand nu uitgesloten —
  // de prijs is dat de pin dan niet meer exact in het midden van het
  // kaartje staat, maar wél op de juiste plek t.o.v. de getoonde tegel.
  const minPositie = KAARTJE_GROOTTE - TEGEL_WEERGAVEGROOTTE;
  const positieX = Math.min(0, Math.max(minPositie, ongeclamptX));
  const positieY = Math.min(0, Math.max(minPositie, ongeclamptY));

  // Pin-positie = waar het punt daadwerkelijk terechtkomt na het clampen
  // van de tegel (i.p.v. de vaste 50%/50%-centrering die ervan uitging dat
  // de tegel altijd ongeclampt gecentreerd kon worden).
  const pinX = px * TEGEL_SCHAAL + positieX;
  const pinY = py * TEGEL_SCHAAL + positieY;

  return (
    <div
      className="melding-mini-kaart"
      style={{ backgroundImage: `url(${tileUrl})`, backgroundSize: `${TEGEL_WEERGAVEGROOTTE}px ${TEGEL_WEERGAVEGROOTTE}px`, backgroundPosition: `${positieX}px ${positieY}px` }}
      title="Locatie van deze melding"
    >
      <span className="melding-mini-kaart-pin" style={{ left: `${pinX}px`, top: `${pinY}px` }}>
        <span className="melding-mini-kaart-pin-icoon">{icoon}</span>
      </span>
    </div>
  );
}
