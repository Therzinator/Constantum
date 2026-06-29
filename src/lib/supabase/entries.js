import { sbClient } from './client.js';
import { sha256 } from '../bewijsmateriaal/hash.js';
import { getMeldingen, saveMeldingen } from '../storage/localStorage.js';
import { laadBijlagenMetadataBatch } from './bijlagen.js';

// Komt overeen met sbSyncMelding() — user wordt meegegeven i.p.v. _sbUser global
export async function sbSyncMelding(melding, user) {
  const sb = sbClient();
  if (!sb || !user) return false;

  // ALLEEN kolommen die bestaan in de entries tabel (schema v3):
  // id, user_id, created_at, timestamp_local, timestamp_utc,
  // type, description, gps_lat, gps_lng, weather,
  // gezondheidsklachten, activiteiten, client_hash,
  // sync_status, warnings, deleted
  // Privacy: e-mailadres hashen voor opslag in entries tabel (DPIA vereiste)
  // Plaintext email blijft uitsluitend in auth.users (Supabase intern)
  // De hash is consistent: dezelfde email geeft altijd dezelfde hash → melderCode werkt nog
  const melderEmailHash = melding.melder_email
    ? await sha256(melding.melder_email)
    : (user.email ? await sha256(user.email) : null);

  const record = {
    id:                   melding.id,
    user_id:              user.id,
    timestamp_local:      melding.timestamp_local  || null,
    timestamp_utc:        melding.timestamp_utc    || null,
    type:                 melding.type             || 'overig',
    types:                melding.types            || [],
    description:          melding.description      || '',
    gps_lat:              melding.gps?.lat         ?? null,
    gps_lng:              melding.gps?.lng         ?? null,
    gps_accuracy:         melding.gps?.accuracy    ?? null,
    weather:              melding.weather          || null,
    geur_intensiteit:     melding.geur_intensiteit ?? null,
    wind_subjectief:      melding.wind_subjectief  || null,
    richting_deg:         melding.richting_deg     ?? null,
    richting_compass:     melding.richting_compass || null,
    gezondheidsklachten:  melding.gezondheidsklachten || [],
    gezondheid_toestemming: melding.gezondheid_toestemming || false,
    opt_in_buurt:         melding.opt_in_buurt     || false,
    opt_in_groepen:       melding.opt_in_groepen   || false,
    activiteiten:         melding.activiteiten     || [],
    drift_waarneming:     melding.drift_waarneming || [],
    wind_naar_woning:     melding.wind_naar_woning || null,
    afstand_woning:       melding.afstand_woning   ?? null,
    afstand_woning_lat:   melding.afstand_woning_lat ?? null,
    afstand_woning_lng:   melding.afstand_woning_lng ?? null,
    natura2000:           melding.natura2000       || null,
    kwetsbare_locaties:   melding.kwetsbare_locaties || [],
    client_hash:          melding.hash             || null,
    rfc3161:              melding.rfc3161          || null,
    melder_email:         melderEmailHash,          // SHA-256 hash, niet plaintext
    bedrijfsnaam:         melding.bedrijfsnaam     || null,
    perceelnummer:        melding.perceelnummer    || null,
    gemeente:             melding.gemeente         || null,
    provincie:            melding.provincie        || null,
    gewas:                melding.gewas            || null,
    sync_status:          'synced',
    warnings:             melding.warnings         || [],
    deleted:              false
  };

  const { error } = await sb.from('entries').upsert(record, { onConflict: 'id' });
  if (error) {
    console.error('[Supabase] Entry sync mislukt:', error.message);
    return false;
  }
  return true;
}

// Batch-variant: upsert meerdere meldingen in één DB-call.
// Geeft een boolean[] terug (index correspondeert met meldingen[]).
export async function sbSyncMeldingenBatch(meldingen, user) {
  const sb = sbClient();
  if (!sb || !user || !meldingen.length) return meldingen.map(() => false);

  let records;
  try {
    records = await Promise.all(meldingen.map(async (melding) => {
      const melderEmailHash = melding.melder_email
        ? await sha256(melding.melder_email)
        : (user.email ? await sha256(user.email) : null);
      return {
        id:                   melding.id,
        user_id:              user.id,
        timestamp_local:      melding.timestamp_local  || null,
        timestamp_utc:        melding.timestamp_utc    || null,
        type:                 melding.type             || 'overig',
        types:                melding.types            || [],
        description:          melding.description      || '',
        gps_lat:              melding.gps?.lat         ?? null,
        gps_lng:              melding.gps?.lng         ?? null,
        gps_accuracy:         melding.gps?.accuracy    ?? null,
        weather:              melding.weather          || null,
        geur_intensiteit:     melding.geur_intensiteit ?? null,
        wind_subjectief:      melding.wind_subjectief  || null,
        richting_deg:         melding.richting_deg     ?? null,
        richting_compass:     melding.richting_compass || null,
        gezondheidsklachten:  melding.gezondheidsklachten || [],
        gezondheid_toestemming: melding.gezondheid_toestemming || false,
        opt_in_buurt:         melding.opt_in_buurt     || false,
        opt_in_groepen:       melding.opt_in_groepen   || false,
        activiteiten:         melding.activiteiten     || [],
        drift_waarneming:     melding.drift_waarneming || [],
        wind_naar_woning:     melding.wind_naar_woning || null,
        afstand_woning:       melding.afstand_woning   ?? null,
        afstand_woning_lat:   melding.afstand_woning_lat ?? null,
        afstand_woning_lng:   melding.afstand_woning_lng ?? null,
        natura2000:           melding.natura2000       || null,
        kwetsbare_locaties:   melding.kwetsbare_locaties || [],
        client_hash:          melding.hash             || null,
        rfc3161:              melding.rfc3161          || null,
        melder_email:         melderEmailHash,
        bedrijfsnaam:         melding.bedrijfsnaam     || null,
        perceelnummer:        melding.perceelnummer    || null,
        gemeente:             melding.gemeente         || null,
        provincie:            melding.provincie        || null,
        gewas:                melding.gewas            || null,
        sync_status:          'synced',
        warnings:             melding.warnings         || [],
        deleted:              false
      };
    }));
  } catch (e) {
    console.error('[Supabase] Batch record bouwen mislukt:', e.message);
    return meldingen.map(() => false);
  }

  const { error } = await sb.from('entries').upsert(records, { onConflict: 'id' });
  if (error) {
    console.error('[Supabase] Batch entry sync mislukt:', error.message);
    return meldingen.map(() => false);
  }
  return meldingen.map(() => true);
}

// Komt overeen met laadVanSupabase() — UI-feedback (toonSyncBalk/toast/
// renderTimeline/updateDashboard) is hier weggelaten; de aanroeper (de
// useSupabaseSync-hook) krijgt een resultaat terug en regelt zelf de UI.
export async function laadVanSupabase(user, force = false) {
  const sb = sbClient();
  if (!sb || !user) throw new Error('Niet ingelogd');
  if (!navigator.onLine) throw new Error('Offline');

  // Privacy: alleen eigen meldingen + meldingen waarvan de melder zelf
  // opt_in_buurt heeft aangezet komen binnen (client-side veiligheidsnet —
  // de eigenlijke afdwinging hoort in de RLS-policy, zie
  // supabase/migrations/0001_dpia_buurt_en_gezondheid.sql)
  const { data: entries, error } = await sb
    .from('entries')
    .select('*')
    .eq('deleted', false)
    .or(`user_id.eq.${user.id},opt_in_buurt.eq.true`)
    .order('timestamp_local', { ascending: false });

  if (error) throw error;

  const lokaal    = getMeldingen();
  const lokaalMap = new Map(lokaal.map(m => [m.id, m]));
  let nieuw = 0, bijgewerkt = 0;

  // Bepaal welke entries bijgewerkt worden en welke bijlagen nodig hebben
  const teBijwerken = entries.filter((entry) => {
    const bestaand = lokaalMap.get(entry.id);
    if (bestaand && !force) {
      const cloudUpdated  = entry.updated_at || entry.created_at;
      const lokaalUpdated = bestaand?.sync_at;
      const cloudIsNieuwer = !lokaalUpdated || new Date(cloudUpdated) > new Date(lokaalUpdated);
      if (!cloudIsNieuwer) return false;
    }
    return true;
  });

  // Één batch-query voor alle benodigde bijlagen (i.p.v. N seriële queries)
  const idsZonderLokaaleBijlagen = teBijwerken
    .filter((e) => !lokaalMap.get(e.id)?.bestanden?.length)
    .map((e) => e.id);
  const bijlagenBatch = await laadBijlagenMetadataBatch(idsZonderLokaaleBijlagen, user);

  for (const entry of teBijwerken) {
    const bestaand = lokaalMap.get(entry.id);

    const cloudUpdated  = entry.updated_at || entry.created_at;

    const bestanden = bestaand?.bestanden?.length
      ? bestaand.bestanden
      : (bijlagenBatch.get(entry.id) || []);

    const tsLocal = entry.timestamp_local || entry.created_at;
    const melding = {
      ...(bestaand || {}),
      id:                  entry.id,
      user_id:             entry.user_id || null,
      created_at:          entry.created_at || null,
      timestamp_local:     tsLocal,
      timestamp_utc:       entry.timestamp_utc || tsLocal,
      date:                new Date(tsLocal).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
      time:                new Date(tsLocal).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
      gps: {
        lat:      entry.gps_lat  ?? null,
        lng:      entry.gps_lng  ?? null,
        accuracy: null,
        status:   'van cloud'
      },
      type:                entry.type        || 'overig',
      description:         entry.description || '',
      melder_email:        entry.melder_email || null,
      geur_intensiteit:    entry.geur_intensiteit ?? null,
      wind_subjectief:     entry.wind_subjectief  || null,
      bedrijfsnaam:        entry.bedrijfsnaam || null,
      perceelnummer:       entry.perceelnummer || null,
      gemeente:            entry.gemeente || null,
      provincie:           entry.provincie || null,
      gewas:               entry.gewas || null,
      afstand_woning:      entry.afstand_woning || null,
      afstand_woning_lat:  entry.afstand_woning_lat ?? null,
      afstand_woning_lng:  entry.afstand_woning_lng ?? null,
      gezondheidsklachten: entry.gezondheidsklachten || [],
      gezondheid_toestemming: entry.gezondheid_toestemming || false,
      opt_in_buurt:        entry.opt_in_buurt || false,
      opt_in_groepen:      entry.opt_in_groepen || false,
      activiteiten:        entry.activiteiten        || [],
      drift_waarneming:    entry.drift_waarneming    || [],
      weather:             entry.weather    || null,
      bestanden,
      warnings:            entry.warnings   || [],
      hash:                entry.client_hash || null,
      sync_status:         'synced',
      sync_at:             cloudUpdated,
      supabase_id:         entry.id
    };

    lokaalMap.set(entry.id, melding);
    if (bestaand) bijgewerkt++; else nieuw++;
  }

  if (nieuw > 0 || bijgewerkt > 0) {
    const gesorteerd = [...lokaalMap.values()]
      .sort((a, b) => new Date(b.timestamp_local) - new Date(a.timestamp_local));
    saveMeldingen(gesorteerd);
  }

  return { nieuw, bijgewerkt };
}
