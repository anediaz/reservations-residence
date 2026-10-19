import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_TTL_MS, peek, subscribe, write } from './cache'
import { ApiError } from './api'

interface UseCachedQueryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): UseCachedQueryResult<T> {
  const [data, setData] = useState<T | null>(() => (key ? peek<T>(key)?.data ?? null : null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const load = useCallback(
    (force: boolean) => {
      if (!key) return
      const current = peek<T>(key)
      if (!force && current && Date.now() - current.timestamp < ttlMs) {
        setData(current.data)
        return
      }
      setLoading(true)
      fetcherRef
        .current()
        .then((result) => {
          write(key, result)
          setError(null)
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
        })
        .finally(() => setLoading(false))
    },
    [key, ttlMs]
  )

  useEffect(() => {
    if (!key) return
    const unsubscribe = subscribe(key, (kind) => {
      if (kind === 'updated') {
        setData(peek<T>(key)?.data ?? null)
      } else {
        load(true)
      }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false)
    return unsubscribe
  }, [key, load])

  return { data, loading, error, reload: () => load(true) }
}
