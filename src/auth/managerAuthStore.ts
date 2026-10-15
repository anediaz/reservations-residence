import { createContext } from 'react'

export interface ManagerSession {
  email: string
  name: string
  role: 'manager'
  idToken: string
}

export interface ManagerAuthValue {
  manager: ManagerSession | null
  status: 'idle' | 'authenticating' | 'error'
  error: string | null
  signInWithGoogle: (idToken: string) => Promise<void>
  signOut: () => void
}

export const ManagerAuthContext = createContext<ManagerAuthValue | null>(null)
