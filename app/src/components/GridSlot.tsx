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
  onMove: (from: number, to: number) => void
  onSelect: (movie: Movie) => void
}

const MOVES = [
  { key: 'up', label: 'Move up', delta: -3, symbol: '↑' },
  { key: 'right', label: 'Move right', delta: 1, symbol: '→' },
  { key: 'down', label: 'Move down', delta: 3, symbol: '↓' },
  { key: 'left', label: 'Move left', delta: -1, symbol: '←' },
] as const

export function GridSlot({ index, movie, total, onRemove, onMove, onSelect }: Props) {
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

      <div
        className="slot-title"
        title={movie.title}
        onClick={() => onSelect(movie)}
        role="presentation"
      >
        {movie.title} <span className="slot-year">{getReleaseYear(movie)}</span>
      </div>

      <div className="slot-actions">
        {MOVES.map(({ key, label, delta, symbol }) => {
          const target = index + delta
          return (
            <button
              key={key}
              type="button"
              className="slot-action"
              aria-label={`${label}: ${movie.title}`}
              disabled={target < 0 || target >= total}
              onClick={() => onMove(index, target)}
            >
              {symbol}
            </button>
          )
        })}
        <button
          type="button"
          className="slot-action slot-action--remove"
          aria-label={`Remove ${movie.title} from grid`}
          onClick={() => onRemove(index)}
        >
          ✕
        </button>
      </div>

      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag ${movie.title} to another slot`}
        {...listeners}
        {...attributes}
      >
        ⠿
      </button>
    </div>
  )
}
