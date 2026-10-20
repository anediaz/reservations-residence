import { useEffect, type ReactNode } from 'react'
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import './App.css'
import ResidentPage from './pages/ResidentPage'
import GestionnairePage from './pages/GestionnairePage'
import ManagerLoginModal from './components/ManagerLoginModal'
import { ManagerAuthProvider } from './auth/ManagerAuthContext'
import { useManagerAuth } from './auth/useManagerAuth'
import { ManagerLoginModalProvider } from './auth/ManagerLoginModalContext'
import { useManagerLoginModal } from './auth/useManagerLoginModal'

function Landing() {
  const { manager } = useManagerAuth()
  const { open } = useManagerLoginModal()
  const navigate = useNavigate()

  function handleManagerClick() {
    if (manager) {
      navigate('/gestionnaire')
      return
    }
    open()
  }

  return (
    <main className="landing">
      <div className="landing-content">
        <h1 className="logo-text">
          PREMS
        </h1>

        <div className="tagline-row">
          <div className="logo-mark">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="6"
                y="18"
                width="36"
                height="24"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M6 22L24 12L42 22"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <rect x="19" y="30" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>

          <p className="tagline">
            Juste une question de booking
          </p>
        </div>

        <div className="cta-group">
          <Link to="/resident" className="cta">
            Je suis résident
          </Link>
          <button type="button" className="cta cta-secondary" onClick={handleManagerClick}>
            Je suis gestionnaire
          </button>
        </div>
      </div>

      <footer className="landing-footer">
        <p>&copy; 2026 Prems</p>
      </footer>
    </main>
  )
}

function RequireManager({ children }: { children: ReactNode }) {
  const { manager } = useManagerAuth()
  const { open } = useManagerLoginModal()

  useEffect(() => {
    if (!manager) open()
  }, [manager, open])

  if (!manager) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <ManagerAuthProvider>
      <ManagerLoginModalProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/resident" element={<ResidentPage />} />
          <Route
            path="/gestionnaire/:tab?"
            element={
              <RequireManager>
                <GestionnairePage />
              </RequireManager>
            }
          />
        </Routes>
        <ManagerLoginModal />
      </ManagerLoginModalProvider>
    </ManagerAuthProvider>
  )
}

export default App
