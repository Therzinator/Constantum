import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON);

let _sb = null; // Supabase client instance

export function sbClient() {
  if (!SUPABASE_ENABLED) return null;
  if (_sb) return _sb;
  try {
    _sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return _sb;
  } catch (e) {
    console.error('[Supabase] Client aanmaken mislukt:', e);
    return null;
  }
}
