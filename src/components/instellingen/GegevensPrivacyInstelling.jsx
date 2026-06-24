import { useEffect, useState } from 'react';
import { laadOnderzoekOptOut, slaOnderzoekOptOutOp } from '../../lib/onderzoek/onderzoekOptOut.js';
import { verwijderAccountData } from '../../lib/supabase/accountVerwijderen.js';
import { meldingenNaarJSONBackup } from '../../lib/export/json.js';
import { downloadFile } from '../../lib/export/download.js';
import { PrivacyVerklaringModal } from '../onboarding/PrivacyVerklaringModal.jsx';
import { WaaromDitErtoeDoetModal } from './WaaromDitErtoeDoetModal.jsx';
import { Toast } from '../ui/Toast.jsx';

// Werkfase H, Feature 3 — onderzoeksdata opt-out + account-/gegevensbeheer.
// De "delen met de buurt"-voorkeur staat al op DeelVoorkeurInstelling.jsx
// (opt_in_buurt zit per melding op de entries-tabel, niet op user_profiles)
// — hier dus alleen onderzoeksdata + account, geen dubbele buurt-toggle.
export function GegevensPrivacyInstelling({ user, meldingenApi, thuislocatie, onUitloggen }) {
  const [onderzoekOptOut, setOnderzoekOptOut] = useState(false);
  const [waaromOpen, setWaaromOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);

  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  useEffect(() => {
    let actief = true;
    laadOnderzoekOptOut(user?.id).then((optOut) => { if (actief) setOnderzoekOptOut(optOut); });
    return () => { actief = false; };
  }, [user]);

  const handleOnderzoekChange = async (e) => {
    const aan = e.target.checked; // "aan" = bijdragen, dus opt_out = !aan
    setOnderzoekOptOut(!aan);
    await slaOnderzoekOptOutOp(user?.id, !aan);
  };

  const handleExportJSON = async () => {
    const meldingen = meldingenApi.meldingen;
    if (!meldingen.length) { toon('Geen gegevens om te exporteren', 'error'); return; }
    const backup = await meldingenNaarJSONBackup(meldingen, thuislocatie?.label);
    downloadFile(JSON.stringify(backup, null, 2), `spuitlog_gegevens_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    toon('✓ Gegevens gedownload', 'success');
  };

  const handleAccountVerwijderen = async () => {
    if (!confirm('Weet u het zeker? Al uw meldingen worden permanent verwijderd. Deze actie kan niet ongedaan worden gemaakt.')) return;

    setBezig(true);
    try {
      if (user) await verwijderAccountData(user.id);
      await meldingenApi.verwijderAlleMeldingenLokaal();
      toon('Account en gegevens verwijderd', 'success');
      await onUitloggen?.();
    } catch (err) {
      toon('Verwijderen mislukt: ' + err.message, 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="section-label mb-3">🔐 Gegevens &amp; Privacy</div>

      <label className="export-info-rij" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
        <span>
          Bijdragen aan wetenschappelijk onderzoek
          <div className="export-card-beschrijving mt-1">
            Uw anonieme meldingsdata helpt wetenschappers bewijzen wat u zelf
            ervaart. Uw identiteit blijft volledig beschermd, u kunt zich
            altijd uitschrijven.
          </div>
          <button
            type="button"
            style={{ marginTop: 4, fontSize: '0.7rem', background: 'none', border: 'none', color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            onClick={(e) => { e.preventDefault(); setWaaromOpen(true); }}
          >
            Waarom dit ertoe doet →
          </button>
        </span>
        <input type="checkbox" checked={!onderzoekOptOut} onChange={handleOnderzoekChange} />
      </label>

      <div className="export-card-beschrijving mt-3 mb-2">Account en gegevens</div>
      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline px-4 py-2" onClick={handleExportJSON}>
          📥 Exporteer al mijn gegevens (JSON)
        </button>
        <button type="button" className="btn-outline px-4 py-2" onClick={() => setPrivacyOpen(true)}>
          📄 Bekijk privacyverklaring
        </button>
        <button
          type="button"
          className="btn-outline px-4 py-2"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          onClick={handleAccountVerwijderen}
          disabled={bezig}
        >
          🗑️ Verwijder mijn account
        </button>
      </div>

      {privacyOpen && <PrivacyVerklaringModal onSluiten={() => setPrivacyOpen(false)} />}
      {waaromOpen && <WaaromDitErtoeDoetModal onSluiten={() => setWaaromOpen(false)} />}
      <Toast melding={melding} />
    </div>
  );
}
