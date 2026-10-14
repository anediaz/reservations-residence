import './App.css'

function App() {
  return (
    <main className="landing">
      <div className="landing-content">
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

        <h1 className="logo-text">
          Réservations<span className="logo-separator">&nbsp;</span>Résidence
        </h1>

        <p className="tagline">
          Gérez vos réservations en toute simplicité
        </p>

        <button type="button" className="cta">
          Commencer
        </button>
      </div>

      <footer className="landing-footer">
        <p>&copy; 2026 Réservations Résidence</p>
      </footer>
    </main>
  )
}

export default App
