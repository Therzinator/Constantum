import { sbClient } from '../supabase/client.js';

// Groepenfunctie — vervangt de losse "Uitnodigen"-deeltoken-flow (zie
// supabase/migrations/0015_groepen.sql). Aanmaken loopt via de
// SECURITY DEFINER-functie fn_groep_aanmaken (zet de aanroeper meteen als
// hoofdbeheerder), zodat er geen INSERT-policy op groep_leden nodig is.
export async function maakGroep({ naam, beschrijving, openbaar, maxBeheerders }) {
  const sb = sbClient();
  if (!sb) return null;

  const { data, error } = await sb.rpc('fn_groep_aanmaken', {
    p_naam: naam,
    p_beschrijving: beschrijving || null,
    p_openbaar: Boolean(openbaar),
    p_max_beheerders: maxBeheerders || 1
  });

  if (error) throw error;
  return data; // nieuwe groep-id (uuid)
}

export async function haalMijnGroepen(userId) {
  const sb = sbClient();
  if (!sb || !userId) return [];

  const { data, error } = await sb
    .from('groep_leden')
    .select('rol, joined_at, groepen(id, naam, beschrijving, openbaar, created_at, hoofdbeheerder_id)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || [])
    .filter((r) => r.groepen)
    .map((r) => ({ ...r.groepen, eigenRol: r.rol, lidSinds: r.joined_at }));
}

export async function haalOpenbareGroepen() {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('groepen')
    .select('id, naam, beschrijving, openbaar, created_at')
    .eq('openbaar', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Direct lid worden van een openbare groep, zonder uitnodiging (sectie 6).
export async function wordLidVanOpenbareGroep(groepId) {
  const sb = sbClient();
  if (!sb) return false;

  const { data, error } = await sb.rpc('fn_groep_openbaar_lid_worden', { p_groep_id: groepId });
  if (error) throw error;
  return Boolean(data);
}

export async function haalGroep(groepId) {
  const sb = sbClient();
  if (!sb || !groepId) return null;

  const { data, error } = await sb
    .from('groepen')
    .select('*')
    .eq('id', groepId)
    .single();

  if (error) throw error;
  return data;
}

// Aantal leden/meldingen/laatste activiteit per groep — losse query i.p.v.
// in haalMijnGroepen()/haalOpenbareGroepen() mee te tellen, anders moet
// elke groepenlijst-load altijd alle aggregaten ophalen, ook wanneer een
// lijst-item nooit opengeklikt wordt.
export async function haalGroepStatistieken(groepId) {
  const sb = sbClient();
  if (!sb || !groepId) return { aantalLeden: 0, aantalMeldingen: 0, laatsteActiviteit: null };

  const [ledenRes, meldingenRes, laatsteRes] = await Promise.all([
    sb.from('groep_leden').select('id', { count: 'exact', head: true }).eq('groep_id', groepId),
    sb.from('entries_groepen').select('entry_id', { count: 'exact', head: true }).eq('groep_id', groepId),
    sb
      .from('entries_groepen')
      .select('gedeeld_op')
      .eq('groep_id', groepId)
      .order('gedeeld_op', { ascending: false })
      .limit(1)
  ]);

  return {
    aantalLeden: ledenRes.count || 0,
    aantalMeldingen: meldingenRes.count || 0,
    laatsteActiviteit: laatsteRes.data?.[0]?.gedeeld_op || null
  };
}

// Alleen door de hoofdbeheerder (RLS, zie migratie 0015) — naam/
// beschrijving/openbaar/max_beheerders.
export async function wijzigGroepInstellingen(groepId, { naam, beschrijving, openbaar, maxBeheerders }) {
  const sb = sbClient();
  if (!sb) return;

  const updates = {};
  if (naam !== undefined) updates.naam = naam;
  if (beschrijving !== undefined) updates.beschrijving = beschrijving;
  if (openbaar !== undefined) updates.openbaar = openbaar;
  if (maxBeheerders !== undefined) updates.max_beheerders = maxBeheerders;

  const { error } = await sb.from('groepen').update(updates).eq('id', groepId);
  if (error) throw error;
}

// Meldingen die de melder zelf met deze groep deelt/intrekt (entries_groepen,
// zie migratie 0015) — los van opt_in_buurt, een expliciete per-groep-keuze.
export async function deelMeldingMetGroep(entryId, groepId) {
  const sb = sbClient();
  if (!sb) return;

  const { error } = await sb.from('entries_groepen').insert({ entry_id: entryId, groep_id: groepId });
  if (error) throw error;
}

export async function trekMeldingTerugUitGroep(entryId, groepId) {
  const sb = sbClient();
  if (!sb) return;

  const { error } = await sb.from('entries_groepen').delete().eq('entry_id', entryId).eq('groep_id', groepId);
  if (error) throw error;
}

export async function haalGroepenVoorMelding(entryId) {
  const sb = sbClient();
  if (!sb || !entryId) return [];

  const { data, error } = await sb.from('entries_groepen').select('groep_id').eq('entry_id', entryId);
  if (error) throw error;
  return (data || []).map((r) => r.groep_id);
}

// Eigen, al gesynchroniseerde meldingen, om uit te kiezen welke met een
// groep gedeeld worden (sectie 1: melder kiest zelf, geen automatisch
// alles-delen). Alleen synced meldingen (hebben een entries.id) komen in
// aanmerking — entries_groepen.entry_id verwijst naar die tabel.
export async function haalEigenMeldingenOmTeDelen(userId) {
  const sb = sbClient();
  if (!sb || !userId) return [];

  const { data, error } = await sb
    .from('entries')
    .select('id, type, description, timestamp_local')
    .eq('user_id', userId)
    .eq('deleted', false)
    .order('timestamp_local', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function haalMeldingenVoorGroep(groepId) {
  const sb = sbClient();
  if (!sb || !groepId) return [];

  const { data, error } = await sb
    .from('entries_groepen')
    .select('gedeeld_op, entries(id, user_id, melder_email, timestamp_local, type, description, postcode, gemeente, provincie, gps_lat, gps_lng, visibility)')
    .eq('groep_id', groepId)
    .order('gedeeld_op', { ascending: false });

  if (error) throw error;
  return (data || []).filter((r) => r.entries).map((r) => ({ ...r.entries, gedeeldOp: r.gedeeld_op }));
}
