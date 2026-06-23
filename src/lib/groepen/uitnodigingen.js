import { sbClient } from '../supabase/client.js';

// Groep-uitnodigingen — vervangt de algemene deeltoken-flow
// (src/lib/supabase/deeltokens.js, verwijderd) door uitnodigingen die aan
// één specifieke groep hangen, met instelbare gebruikerslimiet (1-5) en
// verlooptijd (24/48/72u). Zie supabase/migrations/0015_groepen.sql.

const VERLOOPTIJDEN_UUR = [24, 48, 72];

export async function maakGroepUitnodiging(groepId, userId, { maxGebruikers, verloopUren }) {
  const sb = sbClient();
  if (!sb || !groepId || !userId) return null;

  if (!VERLOOPTIJDEN_UUR.includes(verloopUren)) {
    throw new Error('Ongeldige verlooptijd — kies 24, 48 of 72 uur');
  }

  const verloopt_op = new Date(Date.now() + verloopUren * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('groep_uitnodigingen')
    .insert({ groep_id: groepId, created_by: userId, max_gebruikers: maxGebruikers, verloopt_op })
    .select('id, token, max_gebruikers, gebruikt_aantal, verloopt_op, ingetrokken, keer_geopend, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function haalGroepUitnodigingen(groepId) {
  const sb = sbClient();
  if (!sb || !groepId) return [];

  const { data, error } = await sb
    .from('groep_uitnodigingen')
    .select('id, token, max_gebruikers, gebruikt_aantal, verloopt_op, ingetrokken, keer_geopend, created_at')
    .eq('groep_id', groepId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function trekUitnodigingIn(uitnodigingId) {
  const sb = sbClient();
  if (!sb) return;

  const { error } = await sb.from('groep_uitnodigingen').update({ ingetrokken: true }).eq('id', uitnodigingId);
  if (error) throw error;
}

// Server-side validatie (verlopen/ingetrokken/vol) + lidmaatschap toevoegen
// — geen directe tabeltoegang nodig (fn_groep_uitnodiging_accepteren is
// SECURITY DEFINER, zie migratie 0015). Retourneert de groep-id bij
// succes, null bij een ongeldige/verlopen/volle uitnodiging.
export async function accepteerUitnodiging(token) {
  const sb = sbClient();
  if (!sb || !token) return null;

  const { data, error } = await sb.rpc('fn_groep_uitnodiging_accepteren', { p_token: token });
  if (error) throw error;
  return data;
}

// Publiek aanroepbaar (ook zonder account) — telt alleen hoe vaak de link
// geopend is, voor de statistieken op de groepspagina van de beheerder.
// Best-effort: geen garantie tegen niet-JS-clients/bots, zelfde aanvaarde
// beperking als andere client-side tellers in deze app.
export async function registreerUitnodigingOpening(token) {
  const sb = sbClient();
  if (!sb || !token) return;

  const { error } = await sb.rpc('fn_groep_uitnodiging_geopend', { p_token: token });
  if (error) console.warn('[Groepen] Openings-telling mislukt:', error.message);
}

export function uitnodigingUrl(token) {
  return `${window.location.origin}${window.location.pathname}?groepuitnodiging=${token}`;
}
