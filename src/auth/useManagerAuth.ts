import { useContext } from 'react'
import { ManagerAuthContext, type ManagerAuthValue } from './managerAuthStore'

export function useManagerAuth(): ManagerAuthValue {
  const context = useContext(ManagerAuthContext)
  if (!context) {
    throw new Error('useManagerAuth doit être utilisé dans un ManagerAuthProvider')
  }
  return context
}
