import { getReleaseYear } from '../services/tmdb'
import type { Movie } from '../types/movie'
import { MoviePoster } from './MoviePoster'

type Props = {
  movie: Movie
  isInGrid: boolean
  isGridFull: boolean
  onAdd: (movie: Movie) => void
}

export function MovieCard({ movie, isInGrid, isGridFull, onAdd }: Props) {
  const disabled = isInGrid || isGridFull

  return (
    <li className="movie-card">
      <MoviePoster movie={movie} className="poster--card" />
      <div className="movie-card-body">
        <span className="movie-card-title" title={movie.title}>
          {movie.title}
        </span>
        <span className="movie-card-year">{getReleaseYear(movie)}</span>
        <button
          type="button"
          className="button button--add"
          onClick={() => onAdd(movie)}
          disabled={disabled}
          title={isInGrid ? 'Already in the grid' : undefined}
        >
          {isInGrid ? 'Added' : 'Add'}
        </button>
      </div>
    </li>
  )
}
