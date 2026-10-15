export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getScriptUrl(): string | undefined {
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
    throw new ApiError(data.error)
  }

  return data as T
}
