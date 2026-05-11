# DriftLog — Pesticide Drift Dossier PWA

Juridisch dossieropbouw systeem voor pesticiden drift en spuitactiviteiten.

## Bestanden

```
drift-pwa/
├── index.html       ← Volledige applicatie (HTML + CSS + JS)
├── sw.js            ← Service Worker (offline ondersteuning)
├── manifest.json    ← PWA manifest (installeerbaarheid)
└── README.md        ← Deze documentatie
```

---

## Installatie

### Optie 1: Lokaal openen
1. Kopieer alle bestanden naar een map
2. Open `index.html` direct in Chrome/Safari
3. ⚠️ GPS en Service Worker vereisen HTTPS of localhost

### Optie 2: Lokale server (aanbevolen voor GPS/PWA)
```bash
# Met Python
python3 -m http.server 8080

# Met Node.js
npx serve .

# Open: http://localhost:8080
```

### Optie 3: Gratis hosting (HTTPS voor volledige PWA)
Upload naar GitHub Pages, Netlify, of Vercel:
- GitHub Pages: push naar `/docs` branch → gratis HTTPS
- Netlify: sleep map naar netlify.com → automatisch HTTPS

### Installeren als app op Android/iOS
1. Open de app in Chrome (Android) of Safari (iOS)
2. Android: menu → "Toevoegen aan startscherm"
3. iOS: Deel-knop → "Zet op beginscherm"

---

## API Koppelingen

### Open-Meteo (gratis, geen API key nodig)
De app gebruikt automatisch:
```
https://api.open-meteo.com/v1/forecast?latitude=52.9128&longitude=6.5441
  &current=temperature_2m,relative_humidity_2m,precipitation,
           surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m
  &wind_speed_unit=kmh&timezone=auto
```
✅ Geen registratie nodig  
✅ Tot 10.000 requests/dag gratis  
✅ Historische data beschikbaar via `/v1/archive`

### KNMI Koppeling (uitbreiding)
Voor officiële Nederlandse meetdata:
```javascript
// KNMI Open Data API (vereist registratie op developer.dataplatform.knmi.nl)
const KNMI_API_KEY = 'jouw_api_key';
const url = `https://api.dataplatform.knmi.nl/open-data/v1/datasets/Actuele10mindataKNMIstations/versions/2/files`;
```

---

## Database Structuur

### LocalStorage Key: `driftlog_meldingen`
Array van melding-objecten:

```json
{
  "id": "DL-LQR3X2M-AB3CD",
  "timestamp_local": "2025-01-15T14:32:00.000Z",
  "timestamp_utc": "2025-01-15T13:32:00.000Z",
  "date": "15-01-2025",
  "time": "14:32:00",
  "timezone": "Europe/Amsterdam",
  "device": "Mozilla/5.0 (Linux; Android 13...)...",
  "platform": "Linux armv8l",

  "gps": {
    "lat": 52.912845,
    "lng": 6.544123,
    "accuracy": 8.5
  },

  "type": "spuitactiviteit",
  "description": "Tractor met spuitmachine actief op westelijk perceel",
  "geur_intensiteit": 3,
  "wind_subjectief": "matig",
  "richting_deg": 270,
  "richting_compass": "W",
  "gezondheidsklachten": ["hoofdpijn", "oogirritatie"],
  "activiteiten": ["tractor", "spuitmachine"],
  "notities": "Vorige week ook soortgelijke activiteit",

  "weather": {
    "wind_speed": 18.4,
    "wind_dir": 245,
    "wind_gusts": 28.1,
    "temperature": 12.3,
    "humidity": 78,
    "precipitation": 0.0,
    "pressure": 1015.2,
    "source": "Open-Meteo API",
    "timestamp": "2025-01-15T14:32:05.123Z"
  },
  "weather_raw": { /* volledige API JSON response */ },

  "bestanden": [
    {
      "name": "foto_001.jpg",
      "type": "image/jpeg",
      "size": 2458624,
      "lastModified": 1705321920000,
      "hash": "a3f8e2c1d4...",
      "dataUrl": "data:image/jpeg;base64,..."
    }
  ],

  "version": "1.0.0",
  "hash": "7f2c8d9a1e3b..." /* SHA-256 van alle velden */
}
```

---

## Uitbreiding naar Supabase Backend

### Stap 1: Supabase project aanmaken
1. Ga naar https://supabase.com → nieuw project
2. Noteer je `Project URL` en `anon key`

### Stap 2: Database tabel
```sql
CREATE TABLE meldingen (
  id TEXT PRIMARY KEY,
  timestamp_local TIMESTAMPTZ NOT NULL,
  timestamp_utc TIMESTAMPTZ NOT NULL,
  timezone TEXT,
  device TEXT,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_accuracy REAL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  geur_intensiteit SMALLINT,
  wind_subjectief TEXT,
  richting_deg SMALLINT,
  richting_compass TEXT,
  gezondheidsklachten TEXT[],
  activiteiten TEXT[],
  notities TEXT,
  weather JSONB,
  weather_raw JSONB,
  bestanden JSONB,
  version TEXT,
  hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (aanbevolen)
ALTER TABLE meldingen ENABLE ROW LEVEL SECURITY;
```

### Stap 3: Integratie in app
Voeg toe bovenaan het `<script>` blok:
```javascript
const SUPABASE_URL = 'https://jouwproject.supabase.co';
const SUPABASE_KEY = 'jouw_anon_key';

async function syncToSupabase(melding) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/meldingen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      ...melding,
      gps_lat: melding.gps?.lat,
      gps_lng: melding.gps?.lng,
      gps_accuracy: melding.gps?.accuracy
    })
  });
  if (!res.ok) throw new Error('Supabase sync failed');
}
```

In `submitMelding()`, na `saveMeldingen()`:
```javascript
if (navigator.onLine) {
  syncToSupabase(melding).catch(() => {
    // Queue voor later sync
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push(melding.id);
    localStorage.setItem('sync_queue', JSON.stringify(queue));
  });
}
```

---

## Juridische Betrouwbaarheid

### SHA-256 Verificatie
Iedere melding bevat een SHA-256 hash van alle velden (excl. foto data URLs).
Om een hash te verifiëren:
```javascript
const hashInput = JSON.stringify({ ...melding, hash: null, weather_raw: null, 
  bestanden: melding.bestanden.map(f => ({ ...f, dataUrl: null })) });
const verifyHash = await sha256(hashInput);
console.log(verifyHash === melding.hash ? '✓ Intact' : '✗ Gewijzigd');
```

### Aanbevelingen voor juridisch gebruik
1. **Regelmatige backups**: Exporteer maandelijks als JSON
2. **Timestamp verificatie**: UTC timestamps zijn onafhankelijk van lokale klok
3. **GPS nauwkeurigheid**: De app toont GPS accuracy in meters
4. **Weerdata archivering**: Ruwe JSON wordt volledig opgeslagen
5. **Foto EXIF**: Gebruik originele camera-foto's, niet screenshots

---

## Licentie & Gebruik

Deze software is ontwikkeld voor persoonlijk gebruik bij juridische dossieropbouw.
De geregistreerde waarnemingen vormen geen directe conclusie over causaliteit of gezondheidsschade.
