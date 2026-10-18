import { NavLink } from 'react-router-dom'
import './AppHeader.css'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-header-link app-header-link-active' : 'app-header-link'
}

function AppHeader() {
  return (
    <header className="app-header">
      <NavLink to="/" end className="app-header-logo">
        PREMS
      </NavLink>
      <nav className="app-header-nav">
        <NavLink to="/resident" className={navLinkClass}>
          Espace résident
        </NavLink>
        <NavLink to="/gestionnaire" className={navLinkClass}>
          Espace gestionnaire
        </NavLink>
      </nav>
    </header>
  )
}

export default AppHeader
