interface ReloadButtonProps {
  onClick: () => void
  loading?: boolean
}

function ReloadButton({ onClick, loading }: ReloadButtonProps) {
  return (
    <button
      type="button"
      className={loading ? 'icon-button reload-button reload-button-spinning' : 'icon-button reload-button'}
      title="Recharger"
      aria-label="Recharger"
      disabled={loading}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  )
}

export default ReloadButton
