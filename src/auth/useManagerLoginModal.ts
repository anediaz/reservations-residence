import { useContext } from 'react'
import { ManagerLoginModalContext } from './managerLoginModalStore'

export function useManagerLoginModal() {
  const context = useContext(ManagerLoginModalContext)
  if (!context) {
    throw new Error('useManagerLoginModal doit être utilisé dans un ManagerLoginModalProvider')
  }
  return context
}
