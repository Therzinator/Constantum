import { useEffect, useState } from 'react';
import { PrivacyVerklaringModal } from '../onboarding/PrivacyVerklaringModal.jsx';
import { AlgemeneVoorwaardenModal } from '../onboarding/AlgemeneVoorwaardenModal.jsx';
import { laadAkkoordVoorkeur, slaAkkoordVoorkeurOp } from '../../lib/onboarding/akkoordVoorkeur.js';
import appIcon from '../../assets/app-icon/icon_large.png';
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
  // Verplichte acceptatie vóór eerste gebruik (registreren óf lokaal
  // overslaan) — bestaande gebruikers die inloggen hebben dit al bij hun
  // oorspronkelijke registratie geaccepteerd, dus die knop blijft ongated.
  // Onthoudt de vorige keuze (akkoordVoorkeur.js) zodat het vinkje niet
  // bij elk bezoek aan dit scherm opnieuw aangezet hoeft te worden.
  const [akkoord, setAkkoordState] = useState(laadAkkoordVoorkeur);
  const setAkkoord = (waarde) => {
    setAkkoordState(waarde);
    slaAkkoordVoorkeurOp(waarde);
  };

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
        <div className="auth-branding">
          <img src={appIcon} alt="Constatum" className="auth-app-icon" />
          <div className="auth-branding-tekst">
            <div className="auth-title">Constatum</div>
            <div className="auth-sub">GEOGRAFISCH LOGBOEK</div>
          </div>
        </div>

        {uitnodiging && (
          <div className="auth-info">
            👋 Je bent uitgenodigd voor een groep op Constatum.{' '}
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

          {authError && <div className="auth-error" role="alert">{authError}</div>}
          {signupInfo && <div className="auth-info">{signupInfo}</div>}

          <label className="auth-consent auth-consent-checkbox">
            <input
              type="checkbox"
              checked={akkoord}
              onChange={(e) => setAkkoord(e.target.checked)}
            />
            <span>
              Ik ga akkoord met de{' '}
              <button type="button" className="auth-consent-link" onClick={(e) => { e.preventDefault(); setVoorwaardenOpen(true); }}>
                Algemene Voorwaarden
              </button>{' '}
              en heb de{' '}
              <button type="button" className="auth-consent-link" onClick={(e) => { e.preventDefault(); setPrivacyOpen(true); }}>
                Privacyverklaring
              </button>{' '}
              gelezen.
            </span>
          </label>

          <button
            type="submit"
            className="btn-primary auth-submit"
            disabled={authBusy || (authMode === 'signup' && !akkoord)}
            title={authMode === 'signup' && !akkoord ? 'Accepteer eerst de Algemene Voorwaarden en Privacyverklaring' : undefined}
          >
            {authBusy
              ? (authMode === 'login' ? 'Inloggen...' : 'Registreren...')
              : (authMode === 'login' ? 'Inloggen' : 'Registreren')}
          </button>
        </form>

        <button
          type="button"
          className="auth-skip"
          onClick={skip}
          disabled={!akkoord}
          title={!akkoord ? 'Accepteer eerst de Algemene Voorwaarden en Privacyverklaring' : undefined}
        >
          Overslaan, alleen lokaal werken (geen sync)
        </button>
      </div>

      {privacyOpen && <PrivacyVerklaringModal onSluiten={() => setPrivacyOpen(false)} />}
      {voorwaardenOpen && <AlgemeneVoorwaardenModal onSluiten={() => setVoorwaardenOpen(false)} />}
    </div>
  );
}
