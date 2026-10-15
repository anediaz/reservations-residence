import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, callApi } from '../lib/api'
import { ManagerAuthContext, type ManagerSession } from './managerAuthStore'

interface AuthenticateResponse {
  email: string
  name: string
  role: 'manager'
}

const STORAGE_KEY = 'prems.manager'

export function ManagerAuthProvider({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState<ManagerSession | null>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as ManagerSession) : null
  })
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (manager) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(manager))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [manager])

  async function signInWithGoogle(idToken: string) {
    setStatus('authenticating')
    setError(null)
    try {
      const result = await callApi<AuthenticateResponse>('authenticate', { idToken })
      setManager({ email: result.email, name: result.name, role: result.role })
      setStatus('idle')
    } catch (err) {
      setManager(null)
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue lors de la connexion.')
    }
  }

  function signOut() {
    setManager(null)
    setStatus('idle')
    setError(null)
  }

  return (
    <ManagerAuthContext.Provider value={{ manager, status, error, signInWithGoogle, signOut }}>
      {children}
    </ManagerAuthContext.Provider>
  )
}
