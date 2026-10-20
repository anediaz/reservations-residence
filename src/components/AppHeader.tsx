import { NavLink } from 'react-router-dom'
import { useManagerAuth } from '../auth/useManagerAuth'
import { useManagerLoginModal } from '../auth/useManagerLoginModal'
import './AppHeader.css'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-header-link app-header-link-active' : 'app-header-link'
}

function AppHeader() {
  const { manager } = useManagerAuth()
  const { open } = useManagerLoginModal()

  function handleManagerClick(e: React.MouseEvent) {
    if (manager) return
    e.preventDefault()
    open()
  }

  return (
    <header className="app-header">
      <NavLink to="/" end className="app-header-logo">
        PREMS
      </NavLink>
      <nav className="app-header-nav">
        <NavLink to="/resident" className={navLinkClass}>
          Espace résident
        </NavLink>
        <NavLink to="/gestionnaire" className={navLinkClass} onClick={handleManagerClick}>
          Espace gestionnaire
        </NavLink>
      </nav>
    </header>
  )
}

export default AppHeader
