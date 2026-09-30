import { useEffect, useRef } from 'react'
import { useMovieDetails } from '../hooks/useMovieDetails'
import { getPosterUrl, getReleaseYear } from '../services/tmdb'
import type { Movie } from '../types/movie'

type Props = {
  movie: Movie
  onClose: () => void
}

export function MovieDetailsModal({ movie, onClose }: Props) {
  const { movie: details, loading, error } = useMovieDetails(movie)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<Element | null>(null)

  const shown = details ?? movie

  useEffect(() => {
    restoreFocusRef.current = document.activeElement
    closeButtonRef.current?.focus()
    return () => {
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus()
      }
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      // Keep keyboard focus inside the dialog.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const posterUrl = getPosterUrl(shown.poster_path)

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close details"
        >
          ✕
        </button>

        <div className="modal-media">
          {posterUrl === '' ? (
            <div className="poster-fallback poster-fallback--tall" aria-hidden="true">
              <span className="poster-fallback-title">{shown.title}</span>
            </div>
          ) : (
            <img
              className="modal-poster"
              src={posterUrl}
              alt={`${shown.title} poster`}
              crossOrigin="anonymous"
            />
          )}
        </div>

        <div className="modal-body">
          <h2 id="modal-title" className="modal-title">
            {shown.title}
          </h2>
          <p className="modal-meta">
            <span>{getReleaseYear(shown)}</span>
            {shown.vote_average !== undefined && (
              <span className="modal-rating">★ {shown.vote_average.toFixed(1)}</span>
            )}
          </p>

          {loading && (
            <p className="panel-hint" role="status">
              Loading details…
            </p>
          )}
          {error && (
            <p className="panel-error" role="alert">
              {error}
            </p>
          )}

          <p className="modal-overview">
            {shown.overview?.trim()
              ? shown.overview
              : loading
                ? ' '
                : 'No overview available for this movie.'}
          </p>
        </div>
      </div>
    </div>
  )
}
