export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

const SESSION_ERROR_PREFIX = 'AUTH_SESSION: '

let sessionExpiredHandler: (() => void) | null = null

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler
}

function getScriptUrl(): string | undefined {
  return import.meta.env.VITE_SCRIPT_URL || undefined
}

export async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = getScriptUrl()
  if (!url) {
    throw new ApiError('Backend non configuré (VITE_SCRIPT_URL manquant).')
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
    })
  } catch {
    throw new ApiError('Impossible de joindre le backend.')
  }

  if (!response.ok) {
    throw new ApiError(`Le backend a répondu avec une erreur (${response.status}).`)
  }

  const data = await response.json()
  if (data?.error) {
    if (typeof data.error === 'string' && data.error.startsWith(SESSION_ERROR_PREFIX)) {
      sessionExpiredHandler?.()
      throw new ApiError(data.error.slice(SESSION_ERROR_PREFIX.length))
    }
    throw new ApiError(data.error)
  }

  return data as T
}
