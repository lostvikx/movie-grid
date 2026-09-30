import { useEffect, useState } from 'react'
import { getMovieDetails } from '../services/tmdb'
import type { Movie } from '../types/movie'

type DetailsState = {
  movie: Movie | null
  loading: boolean
  error: string | null
}

function needsFetch(movie: Movie): boolean {
  return !movie.overview || movie.vote_average === undefined
}

/** Loads full details on demand; results are cached per session by the service. */
export function useMovieDetails(movie: Movie | null): DetailsState {
  const [state, setState] = useState<DetailsState>({
    movie,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!movie) {
      setState({ movie: null, loading: false, error: null })
      return
    }
    if (!needsFetch(movie)) {
      setState({ movie, loading: false, error: null })
      return
    }

    const controller = new AbortController()
    setState({ movie, loading: true, error: null })

    getMovieDetails(movie.id, controller.signal)
      .then((full) => setState({ movie: full, loading: false, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          movie,
          loading: false,
          error: error instanceof Error ? error.message : 'Could not load details.',
        })
      })

    return () => controller.abort()
  }, [movie])

  return state
}
