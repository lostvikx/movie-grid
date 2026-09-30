import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Movie } from '../types/movie'
import { MoviePoster } from './MoviePoster'
import { getReleaseYear } from '../services/tmdb'

const slotId = (index: number) => `slot-${index}`

type Props = {
  index: number
  movie: Movie | null
  total: number
  onRemove: (index: number) => void
  onSelect: (movie: Movie) => void
}

export function GridSlot({ index, movie, total, onRemove, onSelect }: Props) {
  const { setNodeRef: setDraggableRef, isDragging, attributes, listeners } =
    useDraggable({ id: slotId(index), disabled: movie === null })
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: slotId(index) })

  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableRef(node)
    setDroppableRef(node)
  }

  const className = [
    'grid-cell',
    movie ? 'is-filled' : 'is-empty',
    isOver ? 'is-over' : '',
    isDragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!movie) {
    return (
      <div
        ref={setNodeRef}
        className={className}
        data-testid={`slot-${index}`}
        aria-label={`Empty slot ${index + 1} of ${total}`}
      >
        <span className="empty-slot-hint">{index + 1}</span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={className}
      data-testid={`slot-${index}`}
      aria-label={`Slot ${index + 1} of ${total}: ${movie.title}`}
    >
      <button
        type="button"
        className="poster-button"
        onClick={() => onSelect(movie)}
        aria-label={`View details for ${movie.title}`}
      >
        <MoviePoster movie={movie} />
      </button>

      <div className="slot-title" title={movie.title} onClick={() => onSelect(movie)} role="presentation">
        {movie.title} <span className="slot-year">{getReleaseYear(movie)}</span>
      </div>

      <div className="cell-tools">
        <button
          type="button"
          className="cell-icon cell-icon--remove"
          aria-label={`Remove ${movie.title} from grid`}
          onClick={() => onRemove(index)}
        >
          ✕
        </button>
        <button
          type="button"
          className="cell-icon cell-icon--drag"
          aria-label={`Drag ${movie.title} to another slot`}
          {...listeners}
          {...attributes}
        >
          ⠿
        </button>
      </div>
    </div>
  )
}
