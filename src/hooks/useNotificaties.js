import { useCallback, useEffect, useState } from 'react';
import { haalMijnGroepen } from '../lib/groepen/groepen.js';
import { sbClient } from '../lib/supabase/client.js';

const STORAGE_KEY = 'spuitlogger_notif_gezien_op';

export function useNotificaties(user) {
  const [aantalOngelezen, setAantalOngelezen] = useState(0);
  const [groepActiviteit, setGroepActiviteit] = useState([]);
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
        const groepen = await haalMijnGroepen(user.id);
        if (!groepen.length || !actief) return;

        const sb = sbClient();
        if (!sb) return;

        const groepIds = groepen.map((g) => g.id);
        const { data } = await sb
          .from('entries_groepen')
          .select('groep_id')
          .in('groep_id', groepIds)
          .gt('gedeeld_op', gezienOp);

        if (!actief) return;

        const perGroep = {};
        (data || []).forEach((r) => {
          perGroep[r.groep_id] = (perGroep[r.groep_id] || 0) + 1;
        });

        const activiteit = groepen
          .filter((g) => perGroep[g.id])
          .map((g) => ({ groepId: g.id, groepNaam: g.naam, aantalNieuw: perGroep[g.id] }));

        setGroepActiviteit(activiteit);
        setAantalOngelezen(Object.values(perGroep).reduce((sum, n) => sum + n, 0));
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
  }, []);

  return { aantalOngelezen, groepActiviteit, markeerAlsGezien };
}
