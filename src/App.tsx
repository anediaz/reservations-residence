import { Routes, Route, Link } from 'react-router-dom'
import './App.css'
import ResidentPage from './pages/ResidentPage'
import GestionnairePage from './pages/GestionnairePage'

function Landing() {
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
          <Link to="/gestionnaire" className="cta cta-secondary">
            Je suis gestionnaire
          </Link>
        </div>
      </div>

      <footer className="landing-footer">
        <p>&copy; 2026 Prems</p>
      </footer>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/resident" element={<ResidentPage />} />
      <Route path="/gestionnaire" element={<GestionnairePage />} />
    </Routes>
  )
}

export default App
