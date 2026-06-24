// Maximale lange-zijde in pixels en JPEG-kwaliteit voor de bewaarde/
// geüploade kopie (niet de losse 800px-UI-thumbnail uit
// lib/media/thumbnail.js). Op 2026-06-24 bewust gekozen i.p.v. de
// originele resolutie/kwaliteit (0,92) onveranderd te bewaren: de
// SHA-256-hash (hashFile() in useNieuweMeldingForm.js) wordt al vóór deze
// stap berekend op het ONBEWERKTE bestand en blijft dus "hash van het
// origineel" — exact zoals nu al in het PDF-dossier toegelicht (zie
// CURRENT_STATE.md), dus deze stap verandert niets aan de bewijswaarde-
// claim. Bij ~3000px/85% is het kwaliteitsverlies visueel vrijwel niet
// waarneembaar (ruim voldoende voor schermweergave én A4-afdruk in het
// PDF-dossier), terwijl moderne telefooncamera's (doorgaans 4000px+)
// hierdoor 40-60% kleiner worden — relevant tegen de Supabase Storage-
// limiet. Video's lopen niet door deze functie (zie useNieuweMeldingForm.js
// — isVideo slaat stripEXIFGPS() over) en blijven dus onverkleind; dat is
// een bewust nog niet aangepakt, apart probleem (zie NEXT_STEPS.md).
const OPSLAG_MAX_PX = 3000;
const OPSLAG_KWALITEIT = 0.85;

// ============================================================
// EXIF-GPS STRIPPER — privacy bescherming melder
// Rendert JPEG opnieuw via canvas zodat alle EXIF metadata
// (inclusief GPS-coördinaten) wordt verwijderd uit het opgeslagen bestand.
// De EXIF-data zelf wordt APART bewaard voor het juridisch dossier.
// Dezelfde canvas-render beperkt meteen ook de afmetingen (zie
// OPSLAG_MAX_PX hierboven) — één decodeer/encodeer-stap i.p.v. twee.
// ============================================================
export async function stripEXIFGPS(dataUrl, mimeType) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img;
      if (width > OPSLAG_MAX_PX || height > OPSLAG_MAX_PX) {
        const ratio = Math.min(OPSLAG_MAX_PX / width, OPSLAG_MAX_PX / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      // Canvas-export heeft geen EXIF — alle metadata is verwijderd
      const cleanDataUrl = canvas.toDataURL(mimeType || 'image/jpeg', OPSLAG_KWALITEIT);
      resolve(cleanDataUrl);
    };
    img.onerror = () => resolve(dataUrl); // Fallback: origineel bij fout
    img.src = dataUrl;
  });
}

// ============================================================
// EXIF EXTRACTIE — puur JavaScript, geen externe library
// Leest JPEG APP1/EXIF segment: datum, GPS, camera
// ============================================================
export async function extractEXIF(file) {
  // Accepteer alle image types — type kan leeg zijn bij camera capture
  if (file.type && !file.type.startsWith('image/jpeg') &&
      !file.type.startsWith('image/jpg') &&
      file.type !== '' && !file.name?.toLowerCase().endsWith('.jpg') &&
      !file.name?.toLowerCase().endsWith('.jpeg')) {
    return null;
  }
  try {
    const buffer = await file.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    const view   = new DataView(buffer);

    // Controleer JPEG SOI marker
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;

    // Zoek APP1 (0xFFE1) segment
    let segStart = 2;
    while (segStart < bytes.length - 4) {
      if (bytes[segStart] !== 0xFF) return null;
      const marker = bytes[segStart + 1];
      const segLen = view.getUint16(segStart + 2, false); // big-endian
      if (marker === 0xE1) break; // APP1
      if (marker === 0xD9 || marker === 0xDA) return null; // EOI/SOS
      segStart += 2 + segLen;
    }
    if (bytes[segStart] !== 0xFF || bytes[segStart + 1] !== 0xE1) return null;

    const app1Start = segStart + 4; // sla FF E1 + length over
    // EXIF header "Exif\0\0"
    if (bytes[app1Start]   !== 0x45 || bytes[app1Start+1] !== 0x78 ||
        bytes[app1Start+2] !== 0x69 || bytes[app1Start+3] !== 0x66) return null;

    const tiff = app1Start + 6; // Begin van TIFF header
    const le   = bytes[tiff] === 0x49; // little endian
    const r16  = (o) => view.getUint16(tiff + o, le);
    const r32  = (o) => view.getUint32(tiff + o, le);

    if (r16(0) !== (le ? 0x4949 : 0x4D4D)) return null;
    if (r16(2) !== 0x002A) return null; // TIFF magic

    const result = {};

    // Lees ASCII string tag — waarde inline als num ≤ 4, anders op offset
    function readASCII(entryOff) {
      const num = r32(entryOff + 4);
      const off = num <= 4 ? (entryOff + 8) : r32(entryOff + 8);
      try {
        return new TextDecoder('ascii')
          .decode(new Uint8Array(buffer, tiff + off, Math.max(0, num - 1)))
          .replace(/\0/g, '').trim();
      } catch { return null; }
    }

    // Lees RATIONAL (teller/noemer)
    function readRational(absOff) {
      const n = view.getUint32(absOff,     le);
      const d = view.getUint32(absOff + 4, le);
      return d ? n / d : 0;
    }

    function parseIFD(ifdOff) {
      if (ifdOff + 2 > bytes.length) return;
      const count = r16(ifdOff);
      for (let i = 0; i < count; i++) {
        const e   = ifdOff + 2 + i * 12;
        const tag = r16(e);
        const typ = r16(e + 2);

        if (tag === 0x010F) result.make  = readASCII(e); // Make
        if (tag === 0x0110) result.model = readASCII(e); // Model
        if (tag === 0x8769 && typ === 4) parseExifIFD(r32(e + 8)); // ExifIFD
        if (tag === 0x8825 && typ === 4) parseGPSIFD(r32(e + 8));  // GPSIFD
      }
    }

    function parseExifIFD(ifdOff) {
      if (ifdOff + 2 > bytes.length) return;
      const count = r16(ifdOff);
      for (let i = 0; i < count; i++) {
        const e   = ifdOff + 2 + i * 12;
        const tag = r16(e);
        const typ = r16(e + 2);
        const num = r32(e + 4);

        // DateTimeOriginal (0x9003) — ASCII "YYYY:MM:DD HH:MM:SS" (19-20 bytes)
        if (tag === 0x9003 && typ === 2 && num >= 19) {
          const off = r32(e + 8);
          try {
            const raw = new TextDecoder('ascii')
              .decode(new Uint8Array(buffer, tiff + off, 19));
            // EXIF datetime is LOKALE tijd — opslaan als lokale ISO zonder Z
            if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
              result.datetime_original = raw.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
            }
          } catch { /* EXIF-datum ontbreekt of is ongeldig — melding blijft zonder datum_original */ }
        }
      }
    }

    function parseGPSIFD(ifdOff) {
      if (ifdOff + 2 > bytes.length) return;
      const count = r16(ifdOff);
      const gps   = {};
      for (let i = 0; i < count; i++) {
        const e   = ifdOff + 2 + i * 12;
        const tag = r16(e);
        const typ = r16(e + 2);
        const num = r32(e + 4);

        // GPSLatitudeRef (1), GPSLatitude (2), GPSLongitudeRef (3), GPSLongitude (4)
        if (tag === 0x0001 && typ === 2) gps.latRef = String.fromCharCode(bytes[tiff + e + 8] || 78);
        if (tag === 0x0003 && typ === 2) gps.lngRef = String.fromCharCode(bytes[tiff + e + 8] || 69);
        if ((tag === 0x0002 || tag === 0x0004) && typ === 5 && num === 3) {
          const base = tiff + r32(e + 8);
          const deg  = readRational(base);
          const min  = readRational(base + 8);
          const sec  = readRational(base + 16);
          const val  = deg + min / 60 + sec / 3600;
          if (tag === 0x0002) gps.lat = val;
          else                gps.lng = val;
        }
        if (tag === 0x0006 && typ === 5) {
          const base = tiff + r32(e + 8);
          gps.altitude = readRational(base);
        }
      }
      if (gps.lat != null && gps.lng != null) {
        result.gps_lat      = gps.latRef === 'S' ? -gps.lat : gps.lat;
        result.gps_lng      = gps.lngRef === 'W' ? -gps.lng : gps.lng;
        result.gps_altitude = gps.altitude ?? null;
      }
    }

    const ifd0 = r32(4);
    parseIFD(ifd0);

    const found = Object.keys(result).filter(k => result[k] != null);
    if (found.length === 0) return null;
    console.log('[EXIF] Gevonden:', found.join(', '), '—', file.name);
    return result;
  } catch (e) {
    console.warn('[EXIF] Extractie mislukt:', e.message, '—', file.name);
    return null;
  }
}
