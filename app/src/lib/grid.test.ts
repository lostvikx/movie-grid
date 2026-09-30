import { describe, expect, it } from 'vitest'
import {
  addMovie,
  containsMovie,
  createEmptyGrid,
  dropMovie,
  firstEmptyIndex,
  isFull,
  moveMovie,
  removeMovie,
  removeMovieAt,
  swapMovies,
} from '../lib/grid'
import type { Movie } from '../types/movie'

function movie(id: number): Movie {
  return {
    id,
    title: `Movie ${id}`,
    release_date: '2020-01-01',
    poster_path: null,
  }
}

const movies = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(movie)

function gridWith(...ids: number[]): (Movie | null)[] {
  const grid = createEmptyGrid()
  ids.forEach((id, index) => {
    grid[index] = id === null ? null : movie(id)
  })
  return grid
}

describe('createEmptyGrid', () => {
  it('creates nine empty slots', () => {
    const grid = createEmptyGrid()
    expect(grid).toHaveLength(9)
    expect(grid.every((slot) => slot === null)).toBe(true)
  })
})

describe('addMovie', () => {
  it('adds to the first empty slot', () => {
    const grid = gridWith(1, 2)
    const next = addMovie(grid, movie(3))
    expect(next[2]?.id).toBe(3)
    expect(firstEmptyIndex(next)).toBe(3)
  })

  it('fills the first gap left by a removal instead of appending', () => {
    let grid = gridWith(1, 2, 3)
    grid = removeMovieAt(grid, 1)
    grid = addMovie(grid, movie(4))
    expect(grid[1]?.id).toBe(4)
    expect(grid[2]?.id).toBe(3)
  })

  it('rejects duplicates', () => {
    const grid = gridWith(1, 2)
    expect(addMovie(grid, movie(1))).toBe(grid)
  })

  it('rejects a full grid', () => {
    const grid = gridWith(...movies.map((m) => m.id))
    expect(isFull(grid)).toBe(true)
    expect(addMovie(grid, movie(99))).toBe(grid)
  })

  it('does not mutate the original grid', () => {
    const grid = createEmptyGrid()
    const next = addMovie(grid, movie(1))
    expect(grid[0]).toBeNull()
    expect(next).not.toBe(grid)
  })
})

describe('removeMovieAt', () => {
  it('empties only the targeted slot', () => {
    const grid = gridWith(1, 2, 3)
    const next = removeMovieAt(grid, 0)
    expect(next[0]).toBeNull()
    expect(next[1]?.id).toBe(2)
    expect(next[2]?.id).toBe(3)
  })

  it('ignores out-of-range and empty slots', () => {
    const grid = gridWith(1, 2)
    expect(removeMovieAt(grid, -1)).toBe(grid)
    expect(removeMovieAt(grid, 9)).toBe(grid)
    expect(removeMovieAt(grid, 5)).toBe(grid)
  })

  it('removes by movie id', () => {
    const grid = gridWith(1, 2, 3)
    const next = removeMovie(grid, 2)
    expect(next[1]).toBeNull()
    expect(containsMovie(next, 2)).toBe(false)
  })
})

describe('moveMovie', () => {
  it('moves a poster into an empty slot', () => {
    const grid = gridWith(1, null, 3)
    const next = moveMovie(grid, 0, 1)
    expect(next[1]?.id).toBe(1)
    expect(next[0]).toBeNull()
    expect(next[2]?.id).toBe(3)
  })

  it('is a no-op for the same slot', () => {
    const grid = gridWith(1, 2)
    expect(moveMovie(grid, 0, 0)).toBe(grid)
  })

  it('is a no-op for an occupied target or invalid indices', () => {
    const grid = gridWith(1, 2)
    expect(moveMovie(grid, 0, 1)).toBe(grid)
    expect(moveMovie(grid, 0, 12)).toBe(grid)
    expect(moveMovie(grid, 4, 0)).toBe(grid)
  })
})

describe('swapMovies', () => {
  it('swaps two occupied slots', () => {
    const grid = gridWith(1, 2, 3)
    const next = swapMovies(grid, 0, 2)
    expect(next[0]?.id).toBe(3)
    expect(next[2]?.id).toBe(1)
    expect(next[1]?.id).toBe(2)
  })

  it('is a no-op when a slot is empty or indices match', () => {
    const grid = gridWith(1, null, 3)
    expect(swapMovies(grid, 0, 1)).toBe(grid)
    expect(swapMovies(grid, 1, 2)).toBe(grid)
    expect(swapMovies(grid, 0, 0)).toBe(grid)
  })
})

describe('dropMovie', () => {
  it('moves when the target slot is empty', () => {
    const grid = gridWith(1, 2, null)
    const next = dropMovie(grid, 0, 2)
    expect(next[2]?.id).toBe(1)
    expect(next[0]).toBeNull()
  })

  it('swaps when the target slot is occupied', () => {
    const grid = gridWith(1, 2, 3)
    const next = dropMovie(grid, 0, 1)
    expect(next[0]?.id).toBe(2)
    expect(next[1]?.id).toBe(1)
  })

  it('is a no-op for the same slot or invalid indices', () => {
    const grid = gridWith(1, 2)
    expect(dropMovie(grid, 1, 1)).toBe(grid)
    expect(dropMovie(grid, 0, -1)).toBe(grid)
    expect(dropMovie(grid, 8, 0)).toBe(grid)
  })
})
