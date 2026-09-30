import { useMemo, useState } from 'react'
import { DownloadButton } from './components/DownloadButton'
import { GridSettings } from './components/GridSettings'
import { MovieDetailsModal } from './components/MovieDetailsModal'
import { MovieGrid } from './components/MovieGrid'
import { MovieSearch } from './components/MovieSearch'
import { addMovie, createEmptyGrid, dropMovie, isFull, removeMovieAt } from './lib/grid'
import type { Movie } from './types/movie'
import { GRID_SIZE } from './types/movie'

export default function App() {
  const [grid, setGrid] = useState<(Movie | null)[]>(createEmptyGrid)
  const [background, setBackground] = useState('#18181b')
  const [spacing, setSpacing] = useState(8)
  const [selected, setSelected] = useState<Movie | null>(null)

  const gridIds = useMemo(
    () => grid.flatMap((movie) => (movie ? [movie.id] : [])),
    [grid],
  )
  const full = isFull(grid)
  const filled = gridIds.length

  function handleAdd(movie: Movie) {
    setGrid((current) => addMovie(current, movie))
  }

  function handleRemove(index: number) {
    setGrid((current) => removeMovieAt(current, index))
  }

  function handleDrop(from: number, to: number) {
    setGrid((current) => dropMovie(current, from, to))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Movie 3×3 Grid</h1>
        <p className="app-subtitle">
          Search TMDB, fill the nine slots, rearrange by dragging, then download
          the grid as a PNG.
        </p>
      </header>

      <main className="app-layout">
        <div className="app-sidebar">
          <MovieSearch
            gridIds={gridIds}
            isGridFull={full}
            onAdd={handleAdd}
          />
          <GridSettings
            background={background}
            spacing={spacing}
            onBackgroundChange={setBackground}
            onSpacingChange={setSpacing}
          />
          <DownloadButton grid={grid} background={background} spacing={spacing} />
        </div>

        <section className="app-stage" aria-label="Grid editor">
          <p className="stage-counter">
            {filled} / {GRID_SIZE} filled
          </p>
          <MovieGrid
            grid={grid}
            background={background}
            spacing={spacing}
            onDrop={handleDrop}
            onRemove={handleRemove}
            onSelect={setSelected}
          />
        </section>
      </main>

      {selected && (
        <MovieDetailsModal movie={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
