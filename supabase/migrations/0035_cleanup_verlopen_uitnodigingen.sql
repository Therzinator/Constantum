-- Automatische opschoning van verlopen en ingetrokken uitnodigingslinks via pg_cron.
-- Vereist: pg_cron extensie (al actief, zie eerdere trust-score migraties).
-- Client-side cleanup in haalGroepUitnodigingen() doet hetzelfde bij elke laadactie;
-- dit is de server-side belt-and-suspenders variant voor gevallen waarbij de app
-- niet actief gebruikt wordt.
--
-- Regel: verwijder uitnodigingen die:
--   - handmatig ingetrokken zijn (ingetrokken = true), OF
--   - langer dan 24 uur verlopen zijn (verloopt_op < NOW() - INTERVAL '24 hours')
--
-- RLS: pg_cron draait als postgres-superuser, geen policy-aanpassing nodig.

SELECT cron.schedule(
  'cleanup_verlopen_uitnodigingen',
  '0 4 * * *',
  $$
  DELETE FROM groep_uitnodigingen
  WHERE
    ingetrokken = true
    OR verloopt_op < NOW() - INTERVAL '24 hours';
  $$
);
