import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { Grid, Movie } from '../types/movie'
import { GridCanvas, MoviePoster } from './MoviePoster'
import { GridSlot } from './GridSlot'

type Props = {
  grid: Grid
  background: string
  spacing: number
  onDrop: (from: number, to: number) => void
  onRemove: (index: number) => void
  onSelect: (movie: Movie) => void
}

function indexFromSlotId(id: string | number | undefined): number {
  if (typeof id !== 'string' || !id.startsWith('slot-')) return -1
  const index = Number(id.slice('slot-'.length))
  return Number.isInteger(index) ? index : -1
}

export function MovieGrid({
  grid,
  background,
  spacing,
  onDrop,
  onRemove,
  onSelect,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const sensors = useSensors(
    // Require a small movement so clicks on posters still open the modal.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const activeMovie = activeIndex === null ? null : grid[activeIndex]

  function handleDragStart(event: DragStartEvent) {
    setActiveIndex(indexFromSlotId(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const from = indexFromSlotId(event.active.id)
    const to = indexFromSlotId(event.over?.id)
    setActiveIndex(null)
    if (from === -1 || to === -1) return
    onDrop(from, to)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveIndex(null)}
    >
      <GridCanvas
        background={background}
        spacing={spacing}
        className="grid-canvas--editor"
        label="Movie grid"
      >
        {grid.map((movie, index) => (
          <GridSlot
            key={index}
            index={index}
            total={grid.length}
            movie={movie}
            onRemove={onRemove}
            onSelect={onSelect}
          />
        ))}
      </GridCanvas>

      <DragOverlay dropAnimation={null}>
        {activeMovie ? <MoviePoster movie={activeMovie} className="poster--drag" /> : null}
      </DragOverlay>
    </DndContext>
  )
}
