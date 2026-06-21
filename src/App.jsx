import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { isHandleidingGezien } from './lib/onboarding/handleidingStatus.js'
import { HandleidingModal } from './components/onboarding/HandleidingModal.jsx'
import { useMeldingen } from './hooks/useMeldingen.js'
import { useSupabaseSync } from './hooks/useSupabaseSync.js'
import { useThuislocatie } from './hooks/useThuislocatie.js'
import { useBuurtNotificaties } from './hooks/useBuurtNotificaties.js'
import { useUitnodigingToken } from './hooks/useUitnodigingToken.js'
import { AppHeader } from './components/layout/AppHeader.jsx'
import { AuthOverlay } from './components/auth/AuthOverlay.jsx'
import { SyncStatusBar } from './components/sync/SyncStatusBar.jsx'
import { OnlineIndicator } from './components/sync/OnlineIndicator.jsx'
import { NotificatieBanner } from './components/notificaties/NotificatieBanner.jsx'
import { UpdateBanner } from './components/pwa/UpdateBanner.jsx'
import { MeldingForm } from './components/melding/MeldingForm.jsx'
import { DashboardPage } from './components/dashboard/DashboardPage.jsx'
import { TijdlijnPage } from './components/meldingen/TijdlijnPage.jsx'
import { ExportPage } from './components/export/ExportPage.jsx'
import { InstellingenPage } from './components/instellingen/InstellingenPage.jsx'
import { CoordinatiePage } from './components/coordinatie/CoordinatiePage.jsx'
import { BottomNav } from './components/nav/BottomNav.jsx'
import { isCoordinatorOfAdmin } from './lib/rollen.js'

function App() {
  const [pagina, setPagina] = useState('dashboard')
  const auth = useAuth()
  const meldingenApi = useMeldingen()
  const thuislocatieApi = useThuislocatie(auth.user)
  const notificatieApi = useBuurtNotificaties(thuislocatieApi.thuislocatie, auth.user)
  const sync = useSupabaseSync(auth.user, meldingenApi, notificatieApi.verwerkNieuweEntry)
  const uitnodiging = useUitnodigingToken(auth.user)
  const [handleidingOpen, setHandleidingOpen] = useState(false)

  // Toont de welkomst-/handleiding-modal automatisch zodra de auth-overlay
  // weg is (ingelogd of "overslaan" gekozen) en de gebruiker hem nog niet
  // heeft gezien. Instellingen → "Over SpuitLogger" kan hem ook handmatig
  // weer openen (zie InstellingenPage.jsx).
  useEffect(() => {
    if (!auth.authOverlayVisible && !isHandleidingGezien()) setHandleidingOpen(true)
  }, [auth.authOverlayVisible])

  return (
    <>
      <AppHeader />
      <AuthOverlay auth={auth} uitnodiging={uitnodiging} />
      {handleidingOpen && <HandleidingModal onSluiten={() => setHandleidingOpen(false)} />}
      <OnlineIndicator />
      <SyncStatusBar syncBezig={sync.syncBezig} syncStatus={sync.syncStatus} />
      <NotificatieBanner banner={notificatieApi.banner} onSluiten={notificatieApi.sluitBanner} />
      <UpdateBanner />

      {pagina === 'dashboard' && (
        <DashboardPage
          meldingenApi={meldingenApi}
          user={auth.user}
          gebruikerRol={auth.gebruikerRol}
          thuislocatie={thuislocatieApi.thuislocatie}
        />
      )}

      {pagina === 'melding' && (
        <MeldingForm
          user={auth.user}
          thuislocatie={thuislocatieApi.thuislocatie}
          meldingenApi={meldingenApi}
          syncNu={sync.syncNu}
          onOpgeslagen={() => setPagina('tijdlijn')}
        />
      )}

      {pagina === 'tijdlijn' && (
        <TijdlijnPage
          meldingenApi={meldingenApi}
          user={auth.user}
          gebruikerRol={auth.gebruikerRol}
        />
      )}

      {pagina === 'export' && (
        <ExportPage
          meldingenApi={meldingenApi}
          thuislocatie={thuislocatieApi.thuislocatie}
        />
      )}

      {pagina === 'instellingen' && (
        <InstellingenPage
          meldingenApi={meldingenApi}
          gebruikerRol={auth.gebruikerRol}
          user={auth.user}
          laadVanCloud={sync.laadVanCloud}
          notificatieApi={notificatieApi}
          thuislocatie={thuislocatieApi.thuislocatie}
          onOpenHandleiding={() => setHandleidingOpen(true)}
          onUitloggen={auth.logout}
        />
      )}

      {pagina === 'coordinatie' && isCoordinatorOfAdmin(auth.gebruikerRol) && (
        <CoordinatiePage user={auth.user} thuislocatie={thuislocatieApi.thuislocatie} />
      )}

      <BottomNav pagina={pagina} onPaginaChange={setPagina} gebruikerRol={auth.gebruikerRol} />
    </>
  )
}

export default App
