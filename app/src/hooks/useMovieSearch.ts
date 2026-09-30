import { useEffect, useRef, useState } from 'react'
import { searchMovies } from '../services/tmdb'
import type { Movie } from '../types/movie'

const DEBOUNCE_MS = 300

type SearchState = {
  results: Movie[]
  loading: boolean
  error: string | null
}

export function useMovieSearch(query: string, limit = 10): SearchState {
  const [state, setState] = useState<SearchState>({
    results: [],
    loading: false,
    error: null,
  })
  // Identifies the newest request so slow, stale responses are discarded.
  const requestIdRef = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    const requestId = ++requestIdRef.current

    if (!trimmed) {
      setState({ results: [], loading: false, error: null })
      return
    }

    const controller = new AbortController()
    setState((prev) => ({ ...prev, loading: true, error: null }))

    const timer = window.setTimeout(async () => {
      try {
        const results = await searchMovies(trimmed, controller.signal)
        if (requestId !== requestIdRef.current) return
        setState({ results: results.slice(0, limit), loading: false, error: null })
      } catch (error) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        setState({
          results: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Something went wrong.',
        })
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, limit])

  return state
}
