import { sbClient } from './client.js';

// Coordinatie & Admin systeem, Fase 4 — admin-queries. Vertrouwt op de
// admin-RLS-bypass uit migratie 0004: een admin krijgt via deze simpele
// .select()-calls automatisch ALLE rijen terug (niet alleen eigen/opt-in),
// een gewone gebruiker alleen zijn eigen rijen — de scheiding gebeurt
// database-side, niet hier.
export async function haalAlleEntriesAdmin() {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('entries')
    .select('id, user_id, melder_email, timestamp_local, type, description, postcode, perceelnummer, opt_in_buurt, visibility, gps_lat, gps_lng, weather')
    .eq('deleted', false)
    .order('timestamp_local', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function haalAlleProfielenAdmin() {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('user_profiles')
    .select('id, trust_score, telefoon_geverifieerd, account_aangemaakt');

  if (error) throw error;
  return data || [];
}

export async function zetTrustScoreAdmin(userId, trustScore) {
  const sb = sbClient();
  if (!sb) return;

  const { error } = await sb
    .from('user_profiles')
    .update({ trust_score: trustScore })
    .eq('id', userId);

  if (error) throw error;
}

export async function zetVisibilityAdmin(entryId, visibility) {
  const sb = sbClient();
  if (!sb) return;

  const { error } = await sb
    .from('entries')
    .update({ visibility })
    .eq('id', entryId);

  if (error) throw error;
}

// Coordinatie & Admin systeem, Fase 6/7 — rijkere selectie (weerdata,
// RFC 3161) voor het buurtrapport, vooraf gefilterd op postcodegebied +
// opt_in_buurt zodat alleen meldingen waarvoor de melder toestemming gaf
// in een collectief dossier terechtkomen.
export async function haalEntriesVoorBuurtrapport(postcodePrefix) {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('entries')
    .select('id, user_id, melder_email, timestamp_local, postcode, perceelnummer, weather, rfc3161, opt_in_buurt, gps_lat, gps_lng')
    .eq('deleted', false)
    .eq('opt_in_buurt', true)
    .ilike('postcode', `${postcodePrefix}%`)
    .order('timestamp_local', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function maakBuurtdossier(dossier, userId) {
  const sb = sbClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from('buurtdossiers')
    .insert({
      postcodegebied: dossier.postcodegebied,
      aangemaakt_door: userId,
      periode_van: dossier.periodeVan,
      periode_tot: dossier.periodeTot,
      aantal_melders: dossier.aantalMelders,
      aantal_meldingen: dossier.aantalMeldingen,
      rapport_json: dossier.rapportJson
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function haalBuurtdossiers() {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('buurtdossiers')
    .select('id, postcodegebied, periode_van, periode_tot, aantal_melders, aantal_meldingen, rapport_json, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Backfill (Fase 1-4) — postcode heeft geen DEFAULT in migratie 0004 (in
// tegenstelling tot opt_in_buurt/visibility, die Postgres bij ADD COLUMN
// automatisch met de DEFAULT-waarde backfilt), dus oudere meldingen
// missen 'm. Vereist een PDOK-lookup per rij, dus geen pure SQL — vandaar
// hier i.p.v. een migratiebestand.
export async function haalEntriesZonderPostcode() {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('entries')
    .select('id, gps_lat, gps_lng')
    .is('postcode', null)
    .not('gps_lat', 'is', null)
    .not('gps_lng', 'is', null);

  if (error) throw error;
  return data || [];
}

export async function zetPostcodeAdmin(entryId, postcode) {
  const sb = sbClient();
  if (!sb) return;

  const { error } = await sb
    .from('entries')
    .update({ postcode })
    .eq('id', entryId);

  if (error) throw error;
}
