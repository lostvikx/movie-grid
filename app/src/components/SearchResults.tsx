import type { Movie } from '../types/movie'
import { MovieCard } from './MovieCard'

type Props = {
  query: string
  results: Movie[]
  loading: boolean
  error: string | null
  gridIds: number[]
  isGridFull: boolean
  onAdd: (movie: Movie) => void
}

export function SearchResults({
  query,
  results,
  loading,
  error,
  gridIds,
  isGridFull,
  onAdd,
}: Props) {
  if (query.trim() === '') {
    return <p className="panel-hint">Search for a movie to start filling the grid.</p>
  }
  if (loading) {
    return (
      <p className="panel-hint" role="status">
        Searching…
      </p>
    )
  }
  if (error) {
    return (
      <p className="panel-error" role="alert">
        {error}
      </p>
    )
  }
  if (results.length === 0) {
    return <p className="panel-hint">No movies found for “{query.trim()}”.</p>
  }

  return (
    <ul className="results-list" aria-label="Search results">
      {results.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          isInGrid={gridIds.includes(movie.id)}
          isGridFull={isGridFull}
          onAdd={onAdd}
        />
      ))}
    </ul>
  )
}
