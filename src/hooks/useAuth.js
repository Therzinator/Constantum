import { useState, useEffect, useCallback, useRef } from 'react';
import { sbClient, SUPABASE_ENABLED } from '../lib/supabase/client.js';

// Komt overeen met authInit/authSubmit/authTab/authSkip/authUitloggen/
// authUpdateUI/laadGebruikerRol uit docs/index.html. DOM-manipulatie
// (authUpdateUI, authTab, document.getElementById in authSubmit) is hier
// bewust niet overgenomen — dat wordt straks declaratieve rendering in
// components/auth/AuthOverlay.jsx (fase 5), gedreven door de state die
// deze hook teruggeeft.
//
// Cloud-sync na inloggen (laadVanSupabase/syncNu/startRealtime) en
// gemeente/thuislocatie-overname uit user_roles horen bij respectievelijk
// useSupabaseSync, useGemeenteProfiel en useThuislocatie (fase 3) — die
// kunnen reageren op wijzigingen in `user`/`gebruikerRol` hieronder.
export function useAuth() {
  const [user, setUser] = useState(null);
  const [gebruikerRol, setGebruikerRol] = useState('gebruiker');
  const [authOverlayVisible, setAuthOverlayVisible] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authError, setAuthError] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const sessieHersteldRef = useRef(false);

  const laadGebruikerRol = useCallback(async (huidigeUser) => {
    const sb = sbClient();
    const actieveUser = huidigeUser || user;
    if (!sb || !actieveUser) return null;
    try {
      const { data } = await sb
        .from('user_roles')
        .select('role, gemeente, thuislocatie_lat, thuislocatie_lng, thuislocatie_label')
        .eq('user_id', actieveUser.id)
        .maybeSingle();
      const rol = data?.role || 'gebruiker';
      setGebruikerRol(rol);
      console.log('[Auth] Rol geladen:', rol);
      return data || null;
    } catch (e) {
      console.warn('[Auth] Rol ophalen mislukt:', e.message);
      setGebruikerRol('gebruiker');
      return null;
    }
  }, [user]);

  // Komt overeen met authInit: sessie herstellen + luisteren op auth state changes
  useEffect(() => {
    const sb = sbClient();
    if (!sb) return;

    let actief = true;

    sb.auth.getSession().then(({ data: { session } }) => {
      if (!actief) return;
      if (session?.user) {
        sessieHersteldRef.current = true;
        setUser(session.user);
        setAuthOverlayVisible(false);
        laadGebruikerRol(session.user);
      } else if (SUPABASE_ENABLED) {
        setTimeout(() => {
          if (actief) setAuthOverlayVisible(true);
        }, 800);
      }
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === 'SIGNED_IN') {
        setAuthOverlayVisible(false);
        sessieHersteldRef.current = false;
        if (session?.user) laadGebruikerRol(session.user);
      }
    });

    return () => {
      actief = false;
      subscription?.unsubscribe();
    };
  }, [laadGebruikerRol]);

  const login = useCallback(async (email, password) => {
    const sb = sbClient();
    if (!sb) return { error: new Error('Supabase niet geconfigureerd') };
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await sb.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data?.session) {
        sessieHersteldRef.current = false;
        setUser(result.data.session.user);
        setAuthOverlayVisible(false);
        laadGebruikerRol(result.data.session.user);
      }
      return result;
    } catch (err) {
      setAuthError(err.message || 'Inloggen mislukt');
      return { error: err };
    } finally {
      setAuthBusy(false);
    }
  }, [laadGebruikerRol]);

  const signup = useCallback(async (email, password) => {
    const sb = sbClient();
    if (!sb) return { error: new Error('Supabase niet geconfigureerd') };
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await sb.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (result.data?.session) {
        // Sessie direct beschikbaar — geen wachttijd op onAuthStateChange nodig
        sessieHersteldRef.current = false;
        setUser(result.data.session.user);
        setAuthOverlayVisible(false);
        laadGebruikerRol(result.data.session.user);
      }
      // Geen result.data.session bij signup => bevestigingsmail vereist (component toont dit)
      return result;
    } catch (err) {
      setAuthError(err.message || 'Registreren mislukt');
      return { error: err };
    } finally {
      setAuthBusy(false);
    }
  }, [laadGebruikerRol]);

  const skip = useCallback(() => {
    setAuthOverlayVisible(false);
  }, []);

  const logout = useCallback(async () => {
    const sb = sbClient();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setGebruikerRol('gebruiker');
  }, []);

  return {
    user,
    gebruikerRol,
    authOverlayVisible,
    authMode,
    authError,
    authBusy,
    setAuthMode,
    setAuthOverlayVisible,
    login,
    signup,
    logout,
    skip,
    laadGebruikerRol
  };
}
