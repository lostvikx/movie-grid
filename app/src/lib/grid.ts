import { GRID_SIZE, type Grid, type Movie } from '../types/movie'

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => null)
}

export function isFull(grid: Grid): boolean {
  return grid.every((slot) => slot !== null)
}

export function containsMovie(grid: Grid, id: number): boolean {
  return grid.some((slot) => slot?.id === id)
}

export function firstEmptyIndex(grid: Grid): number {
  return grid.findIndex((slot) => slot === null)
}

/**
 * Adds a movie to the first empty slot. Returns the unchanged grid when the
 * grid is already full or the movie is already present.
 */
export function addMovie(grid: Grid, movie: Movie): Grid {
  if (isFull(grid) || containsMovie(grid, movie.id)) return grid
  const index = firstEmptyIndex(grid)
  if (index === -1) return grid
  const next = grid.slice()
  next[index] = movie
  return next
}

/** Empties a single slot; other posters keep their positions. */
export function removeMovieAt(grid: Grid, index: number): Grid {
  if (index < 0 || index >= grid.length || grid[index] === null) return grid
  const next = grid.slice()
  next[index] = null
  return next
}

export function removeMovie(grid: Grid, id: number): Grid {
  return removeMovieAt(grid, grid.findIndex((slot) => slot?.id === id))
}

function isValidIndex(grid: Grid, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < grid.length
}

/** Moves a poster to an empty slot. No-ops for same-slot or occupied targets. */
export function moveMovie(grid: Grid, from: number, to: number): Grid {
  if (!isValidIndex(grid, from) || !isValidIndex(grid, to)) return grid
  if (from === to) return grid
  if (grid[from] === null || grid[to] !== null) return grid
  const next = grid.slice()
  next[to] = next[from]
  next[from] = null
  return next
}

/** Swaps the two posters of occupied slots. No-ops if either slot is empty. */
export function swapMovies(grid: Grid, a: number, b: number): Grid {
  if (!isValidIndex(grid, a) || !isValidIndex(grid, b)) return grid
  if (a === b || grid[a] === null || grid[b] === null) return grid
  const next = grid.slice()
  next[a] = grid[b]
  next[b] = grid[a]
  return next
}

/**
 * Drop behaviour: a poster dropped on an empty slot moves there, and a poster
 * dropped on an occupied slot swaps places with it.
 */
export function dropMovie(grid: Grid, from: number, to: number): Grid {
  if (!isValidIndex(grid, from) || !isValidIndex(grid, to)) return grid
  if (from === to) return grid
  return grid[to] === null ? moveMovie(grid, from, to) : swapMovies(grid, from, to)
}
