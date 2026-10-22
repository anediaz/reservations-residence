import { useEffect, useRef } from 'react'

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`)
  if (existing) {
    return new Promise((resolve) => existing.addEventListener('load', () => resolve()))
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Impossible de charger Google Sign-In.'))
    document.head.appendChild(script)
  })
}

interface GoogleSignInButtonProps {
  clientId: string
  onCredential: (idToken: string) => void
}

function GoogleSignInButton({ clientId, onCredential }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    loadGsiScript().then(() => {
      if (cancelled || !buttonRef.current || !window.google) return

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
      })

      buttonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
      })
    })

    return () => {
      cancelled = true
    }
  }, [clientId, onCredential])

  return <div ref={buttonRef} />
}

export default GoogleSignInButton
