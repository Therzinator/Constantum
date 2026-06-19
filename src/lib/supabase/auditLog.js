import { sbClient } from './client.js';
import { APP_VERSION_CLIENT } from '../version.js';

// Komt overeen met sbAuditLog() — user wordt meegegeven i.p.v. _sbUser global
export async function sbAuditLog(entryId, action, detail = {}, user) {
  const sb = sbClient();
  if (!sb || !user) return;
  try {
    const payload = {
      user_id:     user.id,
      entry_id:    entryId || null,
      action:      action  || 'unknown',
      detail:      detail  || {},
      ip_hint:     navigator.userAgent.substring(0, 120),
      app_version: APP_VERSION_CLIENT
    };
    const { error } = await sb.from('audit_log').insert(payload);
    if (error) console.error('[Supabase] audit_log mislukt:', error.message);
  } catch (e) {
    console.error('[Supabase] audit_log exception:', e.message);
  }
}
