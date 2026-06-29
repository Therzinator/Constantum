import { useCallback, useEffect, useState } from 'react';
import { haalMijnGroepen } from '../lib/groepen/groepen.js';
import { sbClient } from '../lib/supabase/client.js';

const STORAGE_KEY = 'spuitlogger_notif_gezien_op';

export function useNotificaties(user) {
  const [aantalOngelezen, setAantalOngelezen] = useState(0);
  const [groepActiviteit, setGroepActiviteit] = useState([]);
  const [nieuweGroepLidmaatschappen, setNieuweGroepLidmaatschappen] = useState([]);
  // Eerste gebruik: 24 uur terug als baseline, zodat niet de hele
  // historie als "nieuw" telt.
  const [gezienOp, setGezienOp] = useState(
    () => localStorage.getItem(STORAGE_KEY) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  );

  useEffect(() => {
    if (!user) return;
    let actief = true;

    (async () => {
      try {
        const sb = sbClient();
        if (!sb) return;

        const groepen = await haalMijnGroepen(user.id);

        // Nieuwe groepslidmaatschappen (voor de huidige gebruiker zelf)
        const { data: lidmaatschapData } = await sb
          .from('groep_leden')
          .select('groep_id, joined_at, groepen(naam)')
          .eq('user_id', user.id)
          .gt('joined_at', gezienOp);

        const nieuweleden = (lidmaatschapData || [])
          .filter((r) => r.groepen)
          .map((r) => ({ groepId: r.groep_id, groepNaam: r.groepen.naam }));

        if (!actief) return;
        setNieuweGroepLidmaatschappen(nieuweleden);

        if (!groepen.length) {
          setGroepActiviteit([]);
          setAantalOngelezen(nieuweleden.length);
          return;
        }

        const groepIds = groepen.map((g) => g.id);

        // Nieuwe meldingen in groepen — eigen meldingen en openbare meldingen
        // worden gefilterd: eigen meldingen hoef je zelf niet te zien, en
        // openbare meldingen (opt_in_buurt) mogen geen notificaties geven
        // omdat dat de app bruikbaar maakt als scanner voor telers.
        const { data } = await sb
          .from('entries_groepen')
          .select('groep_id, entries(user_id, opt_in_buurt)')
          .in('groep_id', groepIds)
          .gt('gedeeld_op', gezienOp);

        if (!actief) return;

        const perGroep = {};
        (data || [])
          .filter((r) => r.entries
            && r.entries.user_id !== user.id
            && !r.entries.opt_in_buurt)
          .forEach((r) => {
            perGroep[r.groep_id] = (perGroep[r.groep_id] || 0) + 1;
          });

        const activiteit = groepen
          .filter((g) => perGroep[g.id])
          .map((g) => ({ groepId: g.id, groepNaam: g.naam, aantalNieuw: perGroep[g.id] }));

        const totaalMeldingen = Object.values(perGroep).reduce((sum, n) => sum + n, 0);
        setGroepActiviteit(activiteit);
        setAantalOngelezen(totaalMeldingen + nieuweleden.length);
      } catch (_) {}
    })();

    return () => { actief = false; };
  }, [user, gezienOp]);

  const markeerAlsGezien = useCallback(() => {
    const nu = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, nu);
    setGezienOp(nu);
    setAantalOngelezen(0);
    setGroepActiviteit([]);
    setNieuweGroepLidmaatschappen([]);
  }, []);

  return { aantalOngelezen, groepActiviteit, nieuweGroepLidmaatschappen, markeerAlsGezien };
}
