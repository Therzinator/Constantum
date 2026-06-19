import { useState, useCallback } from 'react';
import {
  laadThuislocatie,
  zoekAdresPDOK,
  detecteerGPSLocatie,
  slaThuislocatieOp
} from '../lib/thuislocatie.js';

// Komt overeen met laadThuislocatieProfiel/zoekAdres/detecteerThuislocatie/
// slaThuislocatieOp uit docs/index.html. Statusteksten (DOM) zijn vervangen
// door een `status`-state die de component kan tonen.
export function useThuislocatie(user) {
  const [thuislocatie, setThuislocatie] = useState(() => laadThuislocatie());
  const [status, setStatus] = useState(null); // { tekst, type: 'info'|'warning'|'error'|'success' }
  const [busy, setBusy] = useState(false);

  const zoekAdres = useCallback(async (postcode, huisnummer) => {
    setBusy(true);
    setStatus({ tekst: '🔍 Adres opzoeken...', type: 'info' });
    try {
      const loc = await zoekAdresPDOK(postcode, huisnummer);
      setStatus(null);
      return loc;
    } catch (e) {
      setStatus({ tekst: e.message, type: 'warning' });
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const detecteerViaGPS = useCallback(async () => {
    setBusy(true);
    setStatus({ tekst: '📡 GPS ophalen...', type: 'info' });
    try {
      const loc = await detecteerGPSLocatie();
      setStatus({ tekst: '✓ GPS locatie gevonden — klik Opslaan om te bevestigen', type: 'success' });
      return loc;
    } catch (e) {
      setStatus({ tekst: e.message, type: 'error' });
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const opslaan = useCallback(async (lat, lng, label) => {
    setBusy(true);
    try {
      const loc = await slaThuislocatieOp(lat, lng, label, user);
      setThuislocatie(loc);
      setStatus({ tekst: `✓ Opgeslagen: ${loc.label}`, type: 'success' });
      return loc;
    } catch (e) {
      setStatus({ tekst: e.message, type: 'warning' });
      throw e;
    } finally {
      setBusy(false);
    }
  }, [user]);

  return {
    thuislocatie,
    status,
    busy,
    zoekAdres,
    detecteerViaGPS,
    opslaan
  };
}
