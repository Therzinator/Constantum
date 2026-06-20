import { useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { useMeldingen } from './hooks/useMeldingen.js'
import { useSupabaseSync } from './hooks/useSupabaseSync.js'
import { useThuislocatie } from './hooks/useThuislocatie.js'
import { AuthOverlay } from './components/auth/AuthOverlay.jsx'
import { SyncStatusBar } from './components/sync/SyncStatusBar.jsx'
import { MeldingForm } from './components/melding/MeldingForm.jsx'
import { DashboardPage } from './components/dashboard/DashboardPage.jsx'
import { TijdlijnPage } from './components/meldingen/TijdlijnPage.jsx'
import { ExportPage } from './components/export/ExportPage.jsx'
import { BottomNav } from './components/nav/BottomNav.jsx'
import './App.css'

function App() {
  const [pagina, setPagina] = useState('dashboard')
  const auth = useAuth()
  const meldingenApi = useMeldingen()
  const sync = useSupabaseSync(auth.user, meldingenApi)
  const thuislocatieApi = useThuislocatie(auth.user)

  return (
    <>
      <AuthOverlay auth={auth} />
      <SyncStatusBar syncBezig={sync.syncBezig} syncStatus={sync.syncStatus} />

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
        <ExportPage meldingenApi={meldingenApi} thuislocatie={thuislocatieApi.thuislocatie} />
      )}

      <BottomNav pagina={pagina} onPaginaChange={setPagina} />
    </>
  )
}

export default App
