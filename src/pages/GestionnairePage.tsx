import { useNavigate, useParams } from 'react-router-dom'
import { useManagerAuth } from '../auth/useManagerAuth'
import GoogleSignInButton from '../components/GoogleSignInButton'
import AppHeader from '../components/AppHeader'
import RequestsPanel from './gestionnaire/RequestsPanel'
import ReservationsPanel from './gestionnaire/ReservationsPanel'
import ResidentsPanel from './gestionnaire/ResidentsPanel'
import ConfigPanel from './gestionnaire/ConfigPanel'
import './GestionnairePage.css'

type Tab = 'demandes' | 'reservations' | 'residents' | 'configuration'

const TABS: Tab[] = ['demandes', 'reservations', 'residents', 'configuration']

function GestionnairePage() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const { manager, status, error, signInWithGoogle, signOut } = useManagerAuth()
  const { tab: tabParam } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'demandes'

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
          <button type="button" className="cta cta-secondary" onClick={signOut}>
            Se déconnecter
          </button>
        </div>
      </header>

      <nav className="manager-tabs">
        <button
          type="button"
          className={tab === 'demandes' ? 'manager-tab manager-tab-active' : 'manager-tab'}
          onClick={() => setTab('demandes')}
        >
          Demandes
        </button>
        <button
          type="button"
          className={tab === 'reservations' ? 'manager-tab manager-tab-active' : 'manager-tab'}
          onClick={() => setTab('reservations')}
        >
          Réservations
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
        {tab === 'demandes' && <RequestsPanel idToken={manager.idToken} />}
        {tab === 'reservations' && <ReservationsPanel idToken={manager.idToken} />}
        {tab === 'residents' && <ResidentsPanel idToken={manager.idToken} currentEmail={manager.email} />}
        {tab === 'configuration' && <ConfigPanel idToken={manager.idToken} />}
      </section>
      </main>
    </>
  )
}

export default GestionnairePage
