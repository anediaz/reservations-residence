import { useNavigate, useParams } from 'react-router-dom'
import { useManagerAuth } from '../auth/useManagerAuth'
import GoogleSignInButton from '../components/GoogleSignInButton'
import AppHeader from '../components/AppHeader'
import ReservationsPanel from './gestionnaire/ReservationsPanel'
import ResidentsPanel from './gestionnaire/ResidentsPanel'
import ConfigPanel from './gestionnaire/ConfigPanel'
import { listRequests } from '../lib/managerApi'
import { useCachedQuery } from '../lib/useCachedQuery'
import './GestionnairePage.css'

type Tab = 'reservations' | 'residents' | 'configuration'

const TABS: Tab[] = ['reservations', 'residents', 'configuration']

function GestionnairePage() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const { manager, status, error, signInWithGoogle, signOut } = useManagerAuth()
  const { tab: tabParam } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'reservations'
  const { data: requests } = useCachedQuery(
    manager ? `listRequests:${manager.idToken}` : null,
    () => listRequests(manager!.idToken)
  )
  const pendingCount = requests?.length ?? 0

  function setTab(next: Tab) {
    navigate(`/gestionnaire/${next}`)
  }

  if (!clientId) {
    return (
      <>
        <AppHeader />
        <main className="page manager-page">
          <p className="manager-config-warning">
            Connexion gestionnaire non configurée : <code>VITE_GOOGLE_CLIENT_ID</code> manquant.
          </p>
        </main>
      </>
    )
  }

  if (!manager) {
    return (
      <>
        <AppHeader />
        <main className="page manager-page">
          <div className="manager-shell">
            <h1>Espace gestionnaire</h1>
            <p>Connexion réservée aux comptes gestionnaires.</p>
            <GoogleSignInButton clientId={clientId} onCredential={signInWithGoogle} />
            {status === 'authenticating' && <p>Connexion en cours…</p>}
            {status === 'error' && error && <p className="manager-error">{error}</p>}
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <AppHeader />
      <main className="manager-dashboard">
      <header className="manager-header">
        <h1>Espace gestionnaire</h1>
        <div className="manager-header-right">
          <p>{manager.name} ({manager.email})</p>
          <button type="button" className="icon-button" title="Se déconnecter" aria-label="Se déconnecter" onClick={signOut}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </header>

      <nav className="manager-tabs">
        <button
          type="button"
          className={tab === 'reservations' ? 'manager-tab manager-tab-active' : 'manager-tab'}
          onClick={() => setTab('reservations')}
        >
          Réservations
          {pendingCount > 0 && <span className="manager-tab-badge">{pendingCount}</span>}
        </button>
        <button
          type="button"
          className={tab === 'residents' ? 'manager-tab manager-tab-active' : 'manager-tab'}
          onClick={() => setTab('residents')}
        >
          Résidents
        </button>
        <button
          type="button"
          className={tab === 'configuration' ? 'manager-tab manager-tab-active' : 'manager-tab'}
          onClick={() => setTab('configuration')}
        >
          Configuration
        </button>
      </nav>

      <section className="manager-content">
        {tab === 'reservations' && <ReservationsPanel idToken={manager.idToken} />}
        {tab === 'residents' && <ResidentsPanel idToken={manager.idToken} currentEmail={manager.email} />}
        {tab === 'configuration' && <ConfigPanel idToken={manager.idToken} />}
      </section>
      </main>
    </>
  )
}

export default GestionnairePage
