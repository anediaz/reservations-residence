export const DEFAULT_TTL_MS = 2 * 60 * 1000

type Listener = (kind: 'updated' | 'invalidated') => void

interface Entry<T = unknown> {
  data: T
  timestamp: number
}

const store = new Map<string, Entry>()
const listeners = new Map<string, Set<Listener>>()

function emit(key: string, kind: 'updated' | 'invalidated'): void {
  listeners.get(key)?.forEach((listener) => listener(kind))
}

export function peek<T>(key: string): Entry<T> | undefined {
  return store.get(key) as Entry<T> | undefined
}

export function write<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() })
  emit(key, 'updated')
}

export function subscribe(key: string, listener: Listener): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
  }
}

export function invalidate(keyOrPrefix: string): void {
  for (const key of store.keys()) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      store.delete(key)
      emit(key, 'invalidated')
    }
  }
}
