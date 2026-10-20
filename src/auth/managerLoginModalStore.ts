import { createContext } from 'react'

export interface ManagerLoginModalValue {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const ManagerLoginModalContext = createContext<ManagerLoginModalValue | null>(null)
