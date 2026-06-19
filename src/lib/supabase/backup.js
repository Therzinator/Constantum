import { sbClient } from './client.js';
import { sbAuditLog } from './auditLog.js';

// Komt overeen met laadVerwijderdeMeldingen() — geeft de ruwe rijen terug
// i.p.v. zelf innerHTML te bouwen. Admin-check (isAdmin) en het renderen
// van de lijst horen bij de Instellingen-component (fase 5).
export async function haalVerwijderdeMeldingenOp(dagen = 7) {
  const sb = sbClient();
  if (!sb) return [];

  const vanaf = new Date(Date.now() - dagen * 24 * 60 * 60 * 1000).toISOString();

  // Filter op timestamp_local ipv updated_at — robuuster voor oudere entries zonder updated_at
  const { data, error } = await sb
    .from('entries')
    .select('id, timestamp_local, type, description, melder_email, user_id')
    .eq('deleted', true)
    .or(`updated_at.gte.${vanaf},timestamp_local.gte.${vanaf}`)
    .order('timestamp_local', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Komt overeen met herstelMelding() — admin-check en toast/herlaad-orkestratie
// horen bij de aanroepende component/hook; deze functie doet alleen de
// Supabase-mutatie en audit-log.
export async function herstelMelding(id, user) {
  const sb = sbClient();
  if (!sb) throw new Error('Niet ingelogd');

  const { error } = await sb
    .from('entries')
    .update({ deleted: false })
    .eq('id', id);

  if (error) throw error;

  await sbAuditLog(id, 'restored', { door: user?.id, rol: 'admin' }, user);
}
