import { useEffect, useRef, useState } from 'react';
import { accepteerUitnodiging } from '../lib/groepen/uitnodigingen.js';

// Groepenfunctie — vervangt useUitnodigingToken.js (verwijderd samen met
// de oude deeltoken-flow, zie DECISIONS.md). Leest ?groepuitnodiging=<token>
// uit de URL, haalt 'm meteen uit de adresbalk, en accepteert de
// uitnodiging zodra de uitgenodigde daadwerkelijk een account heeft (niet
// eerder — anders zou alleen het OPENEN van de link al als "gebruikt" tellen).
export function useGroepUitnodigingToken(user) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('groepuitnodiging'));
  const geaccepteerdRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    params.delete('groepuitnodiging');
    const nieuweUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', nieuweUrl);
  }, [token]);

  useEffect(() => {
    if (user && token && !geaccepteerdRef.current) {
      geaccepteerdRef.current = true;
      accepteerUitnodiging(token).catch(() => {});
    }
  }, [user, token]);

  return token ? { token } : null;
}
