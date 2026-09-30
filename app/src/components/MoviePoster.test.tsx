import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MoviePoster } from './MoviePoster'
import type { Movie } from '../types/movie'

function movie(id: number, posterPath: string | null): Movie {
  return {
    id,
    title: `Film ${id}`,
    release_date: '2020-01-01',
    poster_path: posterPath,
  }
}

/** Fire the img error handler the way a real failed request would. */
function failImage(container: HTMLElement) {
  const img = container.querySelector('img')
  if (img) fireEvent.error(img)
}

describe('MoviePoster', () => {
  it('renders a placeholder when the movie has no poster', () => {
    const { container } = render(<MoviePoster movie={movie(1, null)} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('Film 1')).toBeInTheDocument()
  })

  it('renders the poster image when a path exists', () => {
    const { container } = render(<MoviePoster movie={movie(1, '/a.jpg')} />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toContain(encodeURIComponent('/a.jpg'))
  })

  it('falls back to a placeholder when the image fails to load', () => {
    const { container, rerender } = render(<MoviePoster movie={movie(1, '/a.jpg')} />)
    failImage(container)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('Film 1')).toBeInTheDocument()

    // Re-rendering with the same broken URL must not loop or throw.
    rerender(<MoviePoster movie={movie(1, '/a.jpg')} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('retries when the slot later holds a different movie', () => {
    const { container, rerender } = render(<MoviePoster movie={movie(1, '/broken.jpg')} />)
    failImage(container)
    expect(container.querySelector('img')).toBeNull()

    // A previous failure must not poison the next poster for this cell.
    rerender(<MoviePoster movie={movie(2, '/working.jpg')} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toContain(encodeURIComponent('/working.jpg'))
  })
})
