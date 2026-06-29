// Coordinatie & Admin systeem — provincie/gemeente-filter via PDOK
// Locatieserver reverse-lookup.
export async function zoekGemeenteProvinciePDOK(lat, lng) {
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${lat}&lon=${lng}&type=adres&rows=1`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const doc = data?.response?.docs?.[0];
  if (!doc) return null;
  return { gemeente: doc.gemeentenaam || null, provincie: doc.provincienaam || null };
}
