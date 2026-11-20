import { useEffect, useState } from 'react'

const cache = new Map<string, unknown>()

export function useJson<T>(name: string) {
  const [data, setData] = useState<T | null>((cache.get(name) as T) ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cache.has(name)) {
      setData(cache.get(name) as T)
      return
    }
    let alive = true
    fetch(`/data/${name}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`加载 ${name} 失败 (${r.status})`)
        return r.json() as Promise<T>
      })
      .then((json) => {
        cache.set(name, json)
        if (alive) setData(json)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [name])

  return { data, error }
}

function readHash() {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, qs = ''] = raw.split('?')
  return { path: path || 'overview', query: new URLSearchParams(qs) }
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => readHash().path)
  useEffect(() => {
    const onChange = () => setRoute(readHash().path)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function useHashQuery() {
  const [query, setQuery] = useState(() => readHash().query)
  useEffect(() => {
    const onChange = () => setQuery(readHash().query)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return query
}

export function go(route: string) {
  window.location.hash = `#/${route}`
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
