import { sbClient } from '../supabase/client.js';

export async function haalGroepLeden(groepId) {
  const sb = sbClient();
  if (!sb || !groepId) return [];

  const { data, error } = await sb
    .from('groep_leden')
    .select('user_id, rol, joined_at, deel_meldingen')
    .eq('groep_id', groepId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Haalt trust_score op voor een lijst user-IDs via user_profiles.
// Voor admin/coordinator: alle profielen zichtbaar (RLS 0011).
// Voor gewone beheerder: alleen eigen profiel — rest wordt niet teruggegeven.
// Retourneert een Map userId → trust_score (null als onbekend).
export async function haalTrustScoresVoorLeden(userIds) {
  const sb = sbClient();
  if (!sb || !userIds.length) return new Map();

  const { data } = await sb
    .from('user_profiles')
    .select('id, trust_score')
    .in('id', userIds);

  const map = new Map();
  (data || []).forEach((p) => map.set(p.id, p.trust_score ?? null));
  return map;
}

// Alleen de hoofdbeheerder (fn_groep_rol_wijzigen bewaakt dit + de
// max_beheerders-limiet, zie migratie 0015) — wijzigt nooit naar/van
// 'hoofdbeheerder'.
export async function wijzigRol(groepId, targetUserId, nieuweRol) {
  const sb = sbClient();
  if (!sb) return false;

  const { data, error } = await sb.rpc('fn_groep_rol_wijzigen', {
    p_groep_id: groepId,
    p_target_user_id: targetUserId,
    p_nieuwe_rol: nieuweRol
  });

  if (error) throw error;
  return Boolean(data);
}

// Door een beheerder/hoofdbeheerder, of door het lid zelf (groep verlaten)
// — fn_groep_lid_verwijderen() staat beide toe, behalve het verwijderen
// van de hoofdbeheerder zelf.
export async function verwijderLid(groepId, targetUserId) {
  const sb = sbClient();
  if (!sb) return false;

  const { data, error } = await sb.rpc('fn_groep_lid_verwijderen', {
    p_groep_id: groepId,
    p_target_user_id: targetUserId
  });

  if (error) throw error;
  return Boolean(data);
}

export async function verlaatGroep(groepId, userId) {
  return verwijderLid(groepId, userId);
}

// Trust-score wijzigen binnen de eigen groep — beperkt tot leden van die
// groep (fn_groep_trust_score_wijzigen, migratie 0015), géén globale
// admin-actie. Voor de globale admin/coordinator-variant: zie
// src/lib/supabase/admin.js#zetTrustScoreAdmin.
export async function wijzigTrustScoreInGroep(groepId, targetUserId, nieuweScore) {
  const sb = sbClient();
  if (!sb) return false;

  const { data, error } = await sb.rpc('fn_groep_trust_score_wijzigen', {
    p_groep_id: groepId,
    p_target_user_id: targetUserId,
    p_nieuwe_score: nieuweScore
  });

  if (error) throw error;
  return Boolean(data);
}
