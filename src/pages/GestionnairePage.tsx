import { useManagerAuth } from '../auth/useManagerAuth'
import GoogleSignInButton from '../components/GoogleSignInButton'
import './GestionnairePage.css'

function GestionnairePage() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const { manager, status, error, signInWithGoogle, signOut } = useManagerAuth()

  if (!clientId) {
    return (
      <main className="page manager-page">
        <p className="manager-config-warning">
          Connexion gestionnaire non configurée : <code>VITE_GOOGLE_CLIENT_ID</code> manquant.
        </p>
      </main>
    )
  }

  if (manager) {
    return (
      <main className="page manager-page">
        <div className="manager-shell">
          <h1>Espace gestionnaire</h1>
          <p>Connecté en tant que {manager.name} ({manager.email})</p>
          <button type="button" className="cta cta-secondary" onClick={signOut}>
            Se déconnecter
          </button>
        </div>
      </main>
    )
  }

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

export default GestionnairePage
