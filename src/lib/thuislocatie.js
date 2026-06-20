import { sbClient, SUPABASE_ENABLED } from './supabase/client.js';

// Standaard locatie — geladen vanuit profiel of fallback naar centrum Nederland
export function laadThuislocatie() {
  const opgeslagen = localStorage.getItem('spuitlog_thuislocatie');
  if (opgeslagen) {
    try {
      const loc = JSON.parse(opgeslagen);
      if (loc.lat && loc.lng) return loc;
    } catch { /* corrupte opslag — val terug op NL-centrum */ }
  }
  // Fallback: centrum van Nederland
  return { lat: 52.3676, lng: 5.2006, label: 'Nederland' };
}

// Zoek adres op via PDOK Locatieserver (postcode + huisnummer)
// Komt overeen met zoekAdres() — geeft {lat, lng, label} terug i.p.v. DOM te muteren
export async function zoekAdresPDOK(postcode, huisnummer) {
  const schoneCode = (postcode || '').trim().replace(/\s/g, '').toUpperCase();
  if (!schoneCode || schoneCode.length < 6) {
    throw new Error('Voer een geldige postcode in (bijv. 1234AB)');
  }

  const query = huisnummer ? `${schoneCode} ${huisnummer.trim()}` : schoneCode;
  const url   = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(query)}&fq=type:adres&rows=1&fl=id,weergavenaam,centroide_ll`;
  const res   = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data  = await res.json();

  const docs = data.response?.docs;
  if (!docs?.length) {
    throw new Error('Adres niet gevonden — controleer postcode/huisnummer');
  }

  const doc   = docs[0];
  const label = doc.weergavenaam || query;
  // centroide_ll formaat: "POINT(lng lat)"
  const match = doc.centroide_ll?.match(/POINT\(([0-9.]+)\s+([0-9.]+)\)/);
  if (!match) throw new Error('Coördinaten niet gevonden in response');

  return { lat: parseFloat(match[2]), lng: parseFloat(match[1]), label };
}

// Reverse geocode lat/lng naar een leesbaar adres (gebruikt door GPS-detectie)
export async function reverseGeocode(lat, lng) {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=nl`);
    const data = await res.json();
    return data.display_name?.split(',').slice(0, 3).join(',').trim() || null;
  } catch {
    return null;
  }
}

// Vraag GPS-positie op via de browser en reverse-geocode meteen het label
// Komt overeen met detecteerThuislocatie()
export function detecteerGPSLocatie() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS niet beschikbaar'));
      return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const label = await reverseGeocode(lat, lng);
      resolve({ lat, lng, label });
    }, () => {
      reject(new Error('GPS geweigerd'));
    }, { enableHighAccuracy: true, timeout: 8000 });
  });
}

// Komt overeen met slaThuislocatieOp() — user wordt meegegeven i.p.v. _sbUser global,
// herlaad van de dashboardkaart (dashMap.setView) hoort bij de component (fase 5)
export async function slaThuislocatieOp(lat, lng, label, user) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    throw new Error('Voer geldige coördinaten in of gebruik GPS-detectie');
  }

  const loc = { lat, lng, label: label || `${lat.toFixed(4)}, ${lng.toFixed(4)}` };

  // Lokaal opslaan
  localStorage.setItem('spuitlog_thuislocatie', JSON.stringify(loc));

  // Sync naar Supabase
  if (SUPABASE_ENABLED && user && navigator.onLine) {
    const sb = sbClient();
    if (sb) {
      const { error } = await sb.from('user_roles').upsert({
        user_id:            user.id,
        thuislocatie_lat:   lat,
        thuislocatie_lng:   lng,
        thuislocatie_label: loc.label
      }, { onConflict: 'user_id' });
      if (error) console.warn('[Supabase] Thuislocatie opslaan mislukt:', error.message);
      else console.log('[Supabase] Thuislocatie opgeslagen');
    }
  }

  return loc;
}
