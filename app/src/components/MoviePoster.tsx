import { useState, type CSSProperties } from 'react'
import { getPosterUrl, getReleaseYear } from '../services/tmdb'
import type { Movie } from '../types/movie'

type Props = {
  movie: Movie
  className?: string
  eager?: boolean
  /**
   * Pre-loaded image bytes. The export stage passes a data URL here so the
   * capture never depends on the browser fetching the poster, and so
   * `html-to-image` never re-fetches (and mis-caches) it.
   */
  dataUrl?: string
}

/** Poster with graceful fallbacks for missing artwork and failed loads. */
export function MoviePoster({ movie, className, eager = false, dataUrl }: Props) {
  // Remember *which* URL failed, so a new poster is retried automatically
  // instead of inheriting the previous failure.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = dataUrl || getPosterUrl(movie.poster_path)
  const showImage = url !== '' && failedUrl !== url

  return (
    <div className={`poster ${className ?? ''}`} data-testid="poster">
      {showImage ? (
        <img
          className="poster-img"
          src={url}
          alt={`${movie.title} poster`}
          loading={eager ? 'eager' : 'lazy'}
          crossOrigin="anonymous"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="poster-fallback" aria-hidden="true">
          <span className="poster-fallback-title">{movie.title}</span>
          <span className="poster-fallback-year">{getReleaseYear(movie)}</span>
        </div>
      )}
    </div>
  )
}

type CanvasProps = {
  background: string
  spacing: number
  className?: string
  style?: CSSProperties
  children: React.ReactNode
  label: string
}

/** Shared grid shell: background and spacing come from CSS variables. */
export function GridCanvas({
  background,
  spacing,
  className,
  style,
  children,
  label,
}: CanvasProps) {
  return (
    <div
      className={`grid-canvas ${className ?? ''}`}
      aria-label={label}
      role="group"
      style={
        {
          '--grid-background': background,
          '--grid-gap': `${spacing}px`,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
