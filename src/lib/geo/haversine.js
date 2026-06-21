export function haversineAfstand(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Komt overeen met de afstandstekst uit lib/notificaties/buurtMelding.js —
// hier los geëxporteerd zodat andere plekken (MeldingCard.jsx) 'm ook kunnen
// gebruiken zonder de notificatie-module te importeren.
export function formatAfstand(afstandMeter) {
  if (afstandMeter == null) return null;
  return afstandMeter >= 1000 ? `${(afstandMeter / 1000).toFixed(1)} km` : `${Math.round(afstandMeter)} m`;
}
