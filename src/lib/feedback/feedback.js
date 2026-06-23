import { sbClient } from '../supabase/client.js';
import { APP_VERSION_CLIENT } from '../version.js';

// Feedback-paneel — zie supabase/migrations/0017_feedback.sql voor het
// volledige RLS-model (technisch = publiek, vraag = privé/admin).
export async function maakFeedback({ type, titel, omschrijving, context }, userId) {
  const sb = sbClient();
  if (!sb || !userId) return null;

  const { data, error } = await sb
    .from('feedback')
    .insert({
      user_id: userId,
      type,
      titel: titel.trim(),
      omschrijving: omschrijving.trim(),
      context: context || null,
      app_version: APP_VERSION_CLIENT
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Geeft terug wat de RLS-policy toestaat: alle 'technisch'-meldingen +
// eigen 'vraag'-meldingen voor een gewone gebruiker, alles voor een admin.
export async function haalFeedback() {
  const sb = sbClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Admin-only (RLS) — status wijzigen, met optionele reactie in dezelfde
// aanroep zodat "In behandeling nemen + toelichting geven" één actie is.
export async function wijzigFeedbackStatus(feedbackId, status, adminReactie) {
  const sb = sbClient();
  if (!sb) return;

  const updates = { status };
  if (adminReactie !== undefined) updates.admin_reactie = adminReactie;

  const { error } = await sb.from('feedback').update(updates).eq('id', feedbackId);
  if (error) throw error;
}
