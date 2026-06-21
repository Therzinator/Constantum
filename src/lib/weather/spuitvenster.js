import { berekenPasquillKlasse } from './pasquill.js';

// Eerste, regel-gebaseerde versie van een "spuitvenster-indicatie" — een
// indicatie van hoe waarschijnlijk het is dat de huidige weersomstandigheden
// een klassiek spuitmoment zijn (rustig, droog weer). Dit is GEEN
// gevalideerd voorspelmodel: de drempelwaarden hieronder zijn vuistregels,
// nog niet getoetst aan daadwerkelijke meldingen. Bedoeld als eerste,
// uitlegbare stap — toekomstig werk is deze drempels bijstellen op basis
// van het patroon in opgeslagen meldingen (weer op het moment van melden),
// niet als black-box ML-model.
//
// Pasquill-klasse vereist insolatie (bewolkingsgraad) en dag/nacht, die het
// Buienradar-station niet direct levert — sunpower (W/m²) dient hier als
// ruwe proxy voor insolatie, en lokale uur-van-de-dag als ruwe proxy voor
// dag/nacht (geen exacte zonsopkomst/-ondergang-berekening).
function schatInsolatieVanZonkracht(sunpowerWm2) {
  if (sunpowerWm2 == null) return 'matig';
  if (sunpowerWm2 > 400) return 'sterk';
  if (sunpowerWm2 > 100) return 'matig';
  return 'licht';
}

function isOverdag() {
  const uur = new Date().getHours();
  return uur >= 7 && uur <= 21;
}

// Som van de eerste 12 stappen (5 min) = neerslag komend uur, in mm.
function neerslagKomendUurMm(regenreeks) {
  if (!regenreeks?.length) return null;
  return regenreeks.slice(0, 12).reduce((s, r) => s + r.mmPerUur * (5 / 60), 0);
}

export function bepaalSpuitvensterIndicatie(station, regenreeks) {
  const windKmh = station?.windspeed != null ? station.windspeed * 3.6 : null;
  if (windKmh == null) return null;

  const neerslagMm = neerslagKomendUurMm(regenreeks) ?? 0;
  const overdag = isOverdag();
  const insolatie = schatInsolatieVanZonkracht(station?.sunpower);
  // schatInsolatieVanZonkracht() gaat uit van zonkracht-overdag — 's nachts
  // is sunpower altijd ~0, dus die waarde dan niet als "licht bewolkt" lezen.
  const pasquill = berekenPasquillKlasse(windKmh, overdag ? (insolatie === 'sterk' ? 20 : insolatie === 'matig' ? 50 : 80) : 50, overdag);

  if (neerslagMm > 0.5) {
    return { niveau: 'laag', tekst: '🟢 Laag — neerslag verwacht (spuiten dan niet effectief/verantwoord)' };
  }
  if (windKmh > 20) {
    return { niveau: 'laag', tekst: '🟢 Laag — te veel wind voor verantwoord spuiten (driftnorm)' };
  }
  if (windKmh >= 1 && windKmh <= 15 && ['C', 'D'].includes(pasquill?.klasse)) {
    return { niveau: 'hoog', tekst: '🔴 Hoog — rustig, droog weer: klassiek spuitvenster' };
  }
  return { niveau: 'matig', tekst: '🟡 Matig' };
}
