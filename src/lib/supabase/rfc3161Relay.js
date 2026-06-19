import { SUPABASE_ENABLED, SUPABASE_URL, SUPABASE_ANON } from './client.js';
import { bouwTSQ, parseTSR } from '../bewijsmateriaal/rfc3161.js';

// Vraag RFC 3161 timestamp op via Supabase Edge Function relay
// (directe browser fetch naar freetsa.org blokkeert vanwege ontbrekende CORS headers)
export async function vraagRFC3161Timestamp(hashHex) {
  try {
    const tsq    = bouwTSQ(hashHex);
    // Base64 de TSQ voor JSON transport naar de Edge Function
    const tsqB64 = btoa(Array.from(tsq).map(b => String.fromCharCode(b)).join(''));

    // Probeer via Supabase Edge Function (vereist deploy van rfc3161-relay)
    let tsrBytes = null;

    if (SUPABASE_ENABLED) {
      try {
        const edgeRes = await fetch(`${SUPABASE_URL}/functions/v1/rfc3161-relay`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON}`
          },
          body: JSON.stringify({ tsq_b64: tsqB64 })
        });
        if (edgeRes.ok) {
          const data = await edgeRes.json();
          if (data.tsr_b64) {
            // Decodeer base64 terug naar bytes
            const bin = atob(data.tsr_b64);
            tsrBytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) tsrBytes[i] = bin.charCodeAt(i);
          }
        } else {
          console.warn('[RFC3161] Edge Function HTTP', edgeRes.status);
        }
      } catch (edgeErr) {
        console.warn('[RFC3161] Edge Function niet bereikbaar:', edgeErr.message);
      }
    }

    if (!tsrBytes) {
      console.warn('[RFC3161] Geen TSR ontvangen — edge function niet beschikbaar');
      return null;
    }

    // Verificeer status (eerste INTEGER in response moet 0 = granted zijn)
    let granted = false;
    for (let i = 2; i < Math.min(30, tsrBytes.length); i++) {
      if (tsrBytes[i] === 0x02 && tsrBytes[i+1] === 0x01) {
        granted = (tsrBytes[i+2] === 0x00 || tsrBytes[i+2] === 0x01);
        break;
      }
    }
    if (!granted) {
      console.warn('[RFC3161] TSA weigerde aanvraag (status niet granted)');
      return null;
    }

    const { genTime, serial } = parseTSR(tsrBytes);
    const token_b64 = btoa(Array.from(tsrBytes).map(b => String.fromCharCode(b)).join(''));

    return {
      token_b64,
      timestamp:  genTime || new Date().toISOString(),
      serial:     serial  || null,
      tsa:        'Freetsa.org (RFC 3161)',
      hash_input: hashHex
    };
  } catch (e) {
    console.warn('[RFC3161] Timestamp mislukt:', e.message);
    return null;
  }
}
