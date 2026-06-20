const HEADERS = [
  'ID', 'Datum', 'Tijd', 'UTC', 'Type', 'Omschrijving', 'Geur Intensiteit', 'Wind Subjectief',
  'Richting (deg)', 'Richting (kompas)', 'Gezondheidsklachten', 'Activiteiten', 'GPS Lat', 'GPS Lng',
  'GPS Accuracy', 'Wind (km/h)', 'Windrichting (deg)', 'Windstoten (km/h)', 'Temperatuur (C)',
  'Luchtvochtigheid (%)', 'Neerslag (mm)', 'Luchtdruk (hPa)', 'Weerdata Bron', 'Aantal Bestanden', 'Hash SHA256'
];

// Komt overeen met exportCSV() uit docs/index.html — pure variant die de
// CSV-string teruggeeft (geen DOM/download).
export function meldingenNaarCSV(meldingen) {
  const rows = meldingen.map((m) => [
    m.id, m.date, m.time, m.timestamp_utc, m.type,
    `"${(m.description || '').replace(/"/g, '""')}"`,
    m.geur_intensiteit, m.wind_subjectief, m.richting_deg, m.richting_compass,
    `"${(m.gezondheidsklachten || []).join(';')}"`,
    `"${(m.activiteiten || []).join(';')}"`,
    m.gps?.lat, m.gps?.lng, m.gps?.accuracy,
    m.weather?.wind_speed, m.weather?.wind_dir, m.weather?.wind_gusts,
    m.weather?.temperature, m.weather?.humidity, m.weather?.precipitation, m.weather?.pressure,
    m.weather?.source, m.bestanden?.length || 0, m.hash
  ].join(','));

  return [HEADERS.join(','), ...rows].join('\n');
}
