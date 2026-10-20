import { useMemo, useState, type ReactNode } from 'react'
import { ManagerLoginModalContext } from './managerLoginModalStore'

export function ManagerLoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [isOpen]
  )

  return <ManagerLoginModalContext.Provider value={value}>{children}</ManagerLoginModalContext.Provider>
}
