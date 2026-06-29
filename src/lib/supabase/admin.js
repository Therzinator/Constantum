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
    .select('id, user_id, melder_email, timestamp_local, type, description, gemeente, provincie, perceelnummer, opt_in_buurt, visibility, gps_lat, gps_lng, weather')
    .eq('deleted', false)
    .order('timestamp_local', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Coordinatie & Admin systeem — volledige entry-selectie voor Buurtgebied
// tekenen → export/Dossier PDF (BuurtgebiedTekenaar.jsx). Bewust een eigen,
// zwaardere query (`select('*')`) i.p.v. haalAlleEntriesAdmin() hierboven
// uit te breiden: die lichte selectie wordt bij elke CoordinatiePage-load
// gebruikt voor de statistiek-kaarten, dit volledige record (incl. hash/
// rfc3161/gezondheidsdata/bestanden-metadata) alleen on-demand bij een
// daadwerkelijke export. Zelfde admin-RLS-bypass als hierboven — geeft ALLE
// meldingen terug, ongeacht opt_in_buurt (anders dan
// haalEntriesVoorBuurtrapport, dat bewust tot opt-in beperkt voor het
// geanonimiseerde collectieve rapport — dit hier is geen anonieme
// aggregatie maar het bestaande, al toegestane admin/coordinator-zicht op
// individuele meldingen).
export async function haalAlleEntriesVoorExportAdmin() {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('entries')
    .select('*')
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
// RFC 3161) voor het buurtrapport, gefilterd op gemeente + opt_in_buurt.
export async function haalEntriesVoorBuurtrapport(gemeente) {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('entries')
    .select('id, user_id, melder_email, timestamp_local, gemeente, perceelnummer, weather, rfc3161, opt_in_buurt, gps_lat, gps_lng')
    .eq('deleted', false)
    .eq('opt_in_buurt', true)
    .ilike('gemeente', `${gemeente}%`)
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

// Coordinatie & Admin systeem — backfill voor het provincie/gemeente-
// filter (migratie 0013), zelfde patroon als de postcode-backfill
// hierboven: historische meldingen van vóór de kolom missen gemeente/
// provincie, eenmalig aanvullen via PDOK.
export async function haalEntriesZonderGemeente() {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('entries')
    .select('id, gps_lat, gps_lng')
    .is('gemeente', null)
    .not('gps_lat', 'is', null)
    .not('gps_lng', 'is', null);

  if (error) throw error;
  return data || [];
}

export async function zetGemeenteProvincieAdmin(entryId, gemeente, provincie) {
  const sb = sbClient();
  if (!sb) return;

  const { error } = await sb
    .from('entries')
    .update({ gemeente, provincie })
    .eq('id', entryId);

  if (error) throw error;
}
