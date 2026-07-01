import { haversineAfstand } from '../geo/haversine.js';

const MAX_TIJDms = 8 * 60 * 60 * 1000; // 8 uur
const MAX_AFSTAND = 300; // meter

// Groepeert meldingen op: zelfde perceel OF GPS-radius 300m (niet
// exclusief!) + tijdvenster 8u — komt overeen met clusterMeldingen() uit
// docs/index.html.
//
// Bug gevonden 2026-07-01: dit was voorheen een if/else — als BEIDE
// meldingen een perceelnummer hadden, werd ALLEEN op perceelnummer
// gematcht en de GPS-afstand niet meer gecontroleerd. Een spuitbeurt die
// over de grens van twee aangrenzende kadastrale percelen loopt (heel
// gewoon in de landbouw) kreeg daardoor twee verschillende
// perceelnummers en werd nooit gekoppeld, ook al lagen de meldingen maar
// een paar honderd meter uit elkaar. Nu een OR: verschillend perceel
// mag, zolang de meldingen dicht genoeg bij elkaar liggen.
export function clusterMeldingen(meldingen) {
  const gesorteerd = [...meldingen].sort(
    (a, b) => new Date(a.timestamp_local) - new Date(b.timestamp_local)
  );

  const clusters = [];

  gesorteerd.forEach((melding) => {
    const cluster = clusters.find((c) => {
      const laatsteMst = new Date(c.meldingen[c.meldingen.length - 1].timestamp_local).getTime();
      const huidigeMst = new Date(melding.timestamp_local).getTime();
      if (huidigeMst - laatsteMst > MAX_TIJDms) return false;

      const zelfdePerceel = Boolean(c.perceelnummer && melding.perceelnummer && c.perceelnummer === melding.perceelnummer);
      const dichtbij = Boolean(
        c.lat && c.lng && melding.gps?.lat && melding.gps?.lng &&
        haversineAfstand(c.lat, c.lng, melding.gps.lat, melding.gps.lng) <= MAX_AFSTAND
      );
      return zelfdePerceel || dichtbij;
    });

    if (cluster) {
      cluster.meldingen.push(melding);
      cluster.eindTijd = melding.timestamp_local;
      const melders = new Set(cluster.meldingen.map((m) => m.melder_email).filter(Boolean));
      cluster.aantalMelders = melders.size || 1;
      if (melding.gps?.lat) {
        cluster.lat = melding.gps.lat;
        cluster.lng = melding.gps.lng;
      }
    } else {
      clusters.push({
        id: `cluster-${melding.id}`,
        perceelnummer: melding.perceelnummer || null,
        lat: melding.gps?.lat || null,
        lng: melding.gps?.lng || null,
        beginTijd: melding.timestamp_local,
        eindTijd: melding.timestamp_local,
        aantalMelders: 1,
        meldingen: [melding]
      });
    }
  });

  return clusters.sort((a, b) => new Date(b.beginTijd) - new Date(a.beginTijd));
}

export function clusterDuur(cluster) {
  const ms = new Date(cluster.eindTijd) - new Date(cluster.beginTijd);
  if (ms < 60000) return null; // < 1 min = één melding
  const uren = Math.floor(ms / 3600000);
  const minuten = Math.floor((ms % 3600000) / 60000);
  return uren > 0 ? `${uren}u${minuten > 0 ? minuten + 'm' : ''}` : `${minuten}m`;
}
