import { useState } from 'react'
import { useManagerAuth } from '../auth/useManagerAuth'
import GoogleSignInButton from '../components/GoogleSignInButton'
import RequestsPanel from './gestionnaire/RequestsPanel'
import ReservationsPanel from './gestionnaire/ReservationsPanel'
import './GestionnairePage.css'

type Tab = 'requests' | 'reservations'

function GestionnairePage() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const { manager, status, error, signInWithGoogle, signOut } = useManagerAuth()
  const [tab, setTab] = useState<Tab>('requests')

  if (!clientId) {
    return (
      <main className="page manager-page">
        <p className="manager-config-warning">
          Connexion gestionnaire non configurée : <code>VITE_GOOGLE_CLIENT_ID</code> manquant.
        </p>
      </main>
    )
  }

  if (!manager) {
    return (
      <main className="page manager-page">
        <div className="manager-shell">
          <h1>Espace gestionnaire</h1>
          <p>Connexion réservée aux comptes gestionnaires.</p>
          <GoogleSignInButton clientId={clientId} onCredential={signInWithGoogle} />
          {status === 'authenticating' && <p>Connexion en cours…</p>}
          {status === 'error' && error && <p className="manager-error">{error}</p>}
        </div>
      </main>
    )
  }

  return (
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
          className={tab === 'requests' ? 'manager-tab manager-tab-active' : 'manager-tab'}
          onClick={() => setTab('requests')}
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
      </nav>

      <section className="manager-content">
        {tab === 'requests' ? (
          <RequestsPanel idToken={manager.idToken} />
        ) : (
          <ReservationsPanel idToken={manager.idToken} />
        )}
      </section>
    </main>
  )
}

export default GestionnairePage
