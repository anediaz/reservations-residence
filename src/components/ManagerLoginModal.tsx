import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useManagerAuth } from '../auth/useManagerAuth'
import { useManagerLoginModal } from '../auth/useManagerLoginModal'
import GoogleSignInButton from './GoogleSignInButton'

function ManagerLoginModal() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const { manager, status, error, signInWithGoogle } = useManagerAuth()
  const { isOpen, close } = useManagerLoginModal()
  const navigate = useNavigate()

  useEffect(() => {
    if (manager && isOpen) {
      close()
      navigate('/gestionnaire')
    }
  }, [manager, isOpen, close, navigate])

  if (!isOpen || manager) return null

  const isAuthenticating = status === 'authenticating'

  return (
    <div className="manager-login-overlay" onClick={isAuthenticating ? undefined : close}>
      <div className="manager-login-modal" onClick={(e) => e.stopPropagation()}>
        {!isAuthenticating && (
          <button type="button" className="manager-login-close" aria-label="Fermer" onClick={close}>
            ×
          </button>
        )}
        <h2>Espace gestionnaire</h2>
        {!clientId ? (
          <p className="manager-config-warning">
            Connexion gestionnaire non configurée : <code>VITE_GOOGLE_CLIENT_ID</code> manquant.
          </p>
        ) : (
          <>
            <p>Connectez-vous avec votre compte gestionnaire.</p>
            <GoogleSignInButton clientId={clientId} onCredential={signInWithGoogle} />
            {status === 'authenticating' && <p>Connexion en cours…</p>}
            {status === 'error' && error && <p className="manager-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}

export default ManagerLoginModal
