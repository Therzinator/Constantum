import { useEffect, useState } from 'react';
import { haalGebruikersProfiel } from '../lib/supabase/profiel.js';

// Coordinatie & Admin systeem, Fase 3 — laadt het trust-profiel van de
// ingelogde gebruiker opnieuw bij elke login/uitlog-wissel.
export function useGebruikersProfiel(user) {
  const [profiel, setProfiel] = useState(null);

  useEffect(() => {
    let actief = true;
    (async () => {
      const data = user ? await haalGebruikersProfiel(user.id) : null;
      if (actief) setProfiel(data);
    })();
    return () => { actief = false; };
  }, [user]);

  return profiel;
}
