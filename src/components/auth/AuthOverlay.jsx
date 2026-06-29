import { useEffect, useState } from 'react';
import { PrivacyVerklaringModal } from '../onboarding/PrivacyVerklaringModal.jsx';
import { AlgemeneVoorwaardenModal } from '../onboarding/AlgemeneVoorwaardenModal.jsx';
import './AuthOverlay.css';

// React-versie van het #auth-overlay blok + authTab/authSubmit/authSkip uit
// docs/index.html. `auth` is het object dat hooks/useAuth.js teruggeeft.
// `uitnodiging` (optioneel, zie hooks/useGroepUitnodigingToken.js) zet de
// tab geforceerd op registreren — de uitnodiging zelf wordt pas na
// inloggen/registreren geaccepteerd (zie die hook), hier alleen de tab-
// forcering en een korte uitleg, geen groep-/meldingdata vóór inloggen.
export function AuthOverlay({ auth, uitnodiging }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupInfo, setSignupInfo] = useState(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [voorwaardenOpen, setVoorwaardenOpen] = useState(false);

  const {
    authOverlayVisible,
    authMode,
    authError,
    authBusy,
    setAuthMode,
    login,
    signup,
    skip
  } = auth;

  useEffect(() => {
    if (uitnodiging) setAuthMode('signup');
  }, [uitnodiging, setAuthMode]);

  if (!authOverlayVisible) return null;

  const kiesTab = (mode) => {
    setAuthMode(mode);
    setSignupInfo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSignupInfo(null);

    const result = authMode === 'login'
      ? await login(email, password)
      : await signup(email, password);

    if (!result.error && authMode === 'signup' && !result.data?.session) {
      setSignupInfo(
        uitnodiging
          ? '✓ Bevestigingsmail verstuurd. Na het klikken op de bevestigingslink word je automatisch lid van de groep — je hoeft de uitnodigingslink niet opnieuw te openen.'
          : '✓ Bevestigingsmail verstuurd. Controleer uw inbox.'
      );
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-title">SpuitLogger</div>
        <div className="auth-sub">SPUITACTIVITEITEN DOSSIER · INLOGGEN</div>

        {uitnodiging && (
          <div className="auth-info">
            👋 Je bent uitgenodigd voor een groep op SpuitLogger.{' '}
            Al een account?{' '}
            <button type="button" className="auth-consent-link" onClick={() => kiesTab('login')}>
              Log hier in
            </button>
            . Nieuw hier? Registreer — je wordt automatisch lid zodra
            je je e-mailadres bevestigd hebt.
          </div>
        )}

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => kiesTab('login')}
          >
            Inloggen
          </button>
          <button
            type="button"
            className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
            onClick={() => kiesTab('signup')}
          >
            Registreren
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="auth-fields">
            <div className="auth-field">
              <label className="section-label" htmlFor="auth-email">E-mailadres</label>
              <input
                id="auth-email"
                type="email"
                className="form-input"
                placeholder="naam@voorbeeld.nl"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="auth-field">
              <label className="section-label" htmlFor="auth-password">Wachtwoord</label>
              <input
                id="auth-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {authError && <div className="auth-error">{authError}</div>}
          {signupInfo && <div className="auth-info">{signupInfo}</div>}

          <button type="submit" className="btn-primary auth-submit" disabled={authBusy}>
            {authBusy
              ? (authMode === 'login' ? 'Inloggen...' : 'Registreren...')
              : (authMode === 'login' ? 'Inloggen' : 'Registreren')}
          </button>

          {authMode === 'signup' && (
            <div className="auth-consent">
              Door te registreren gaat u akkoord met de{' '}
              <button type="button" className="auth-consent-link" onClick={(e) => { e.preventDefault(); setVoorwaardenOpen(true); }}>
                Algemene Voorwaarden
              </button>{' '}
              en heeft u de{' '}
              <button type="button" className="auth-consent-link" onClick={(e) => { e.preventDefault(); setPrivacyOpen(true); }}>
                Privacyverklaring
              </button>{' '}
              gelezen.
            </div>
          )}
        </form>

        <button type="button" className="auth-skip" onClick={skip}>
          Overslaan, alleen lokaal werken (geen sync)
        </button>
      </div>

      {privacyOpen && <PrivacyVerklaringModal onSluiten={() => setPrivacyOpen(false)} />}
      {voorwaardenOpen && <AlgemeneVoorwaardenModal onSluiten={() => setVoorwaardenOpen(false)} />}
    </div>
  );
}
