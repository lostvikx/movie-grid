import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toPng } from 'html-to-image'
import { DownloadButton } from './DownloadButton'
import { collectPosterPaths, preparePosters } from '../lib/posters'
import { clearDetailsCache } from '../services/tmdb'
import type { Grid, Movie } from '../types/movie'

vi.mock('html-to-image', () => ({ toPng: vi.fn() }))

const toPngMock = vi.mocked(toPng)

function movie(id: number, path: string | null = `/poster${id}.jpg`): Movie {
  return {
    id,
    title: `Film ${id}`,
    release_date: '2020-01-01',
    poster_path: path,
    overview: '',
    vote_average: 7,
  }
}

function fullGrid(): Grid {
  return Array.from({ length: 9 }, (_, i) => movie(i + 1))
}

function imageResponse(ok = true, size = 1024) {
  return {
    ok,
    status: ok ? 200 : 500,
    blob: async () => new Blob(['x'.repeat(size)]),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>
/** Anchors the component creates to trigger the download. */
const createdAnchors: HTMLAnchorElement[] = []

beforeEach(() => {
  clearDetailsCache()
  fetchMock = vi.fn().mockResolvedValue(imageResponse())
  vi.stubGlobal('fetch', fetchMock)
  toPngMock.mockReset()
  toPngMock.mockResolvedValue('data:image/png;base64,AAAA')
  createdAnchors.length = 0
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...rest: unknown[]) => {
    const element = createElement(tag, ...(rest as []))
    if (tag === 'a') createdAnchors.push(element as HTMLAnchorElement)
    return element
  })
  // The anchor is detached, so clicking it would only try to navigate.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('poster helpers', () => {
  it('collects each distinct poster path once', () => {
    const grid: Grid = [movie(1, '/a.jpg'), null, movie(2, '/a.jpg'), movie(3, '/b.jpg')]
    expect(collectPosterPaths(grid)).toEqual(['/a.jpg', '/b.jpg'])
  })

  it('skips movies without artwork', () => {
    const grid: Grid = [movie(1, null), movie(2, '/b.jpg')]
    expect(collectPosterPaths(grid)).toEqual(['/b.jpg'])
  })

  it('returns a data URL per poster', async () => {
    const { urls, failed } = await preparePosters([movie(1), movie(2)])

    expect(failed).toEqual([])
    expect(urls.size).toBe(2)
    for (const dataUrl of urls.values()) {
      expect(dataUrl).toMatch(/^data:/)
    }
  })

  it('reports which posters could not be loaded', async () => {
    fetchMock.mockImplementation((url: string) => {
      const failed = url.includes('poster2')
      return Promise.resolve(imageResponse(!failed, failed ? 0 : 512))
    })

    const { failed } = await preparePosters([movie(1), movie(2), movie(3)])

    expect(failed).toEqual(['/poster2.jpg'])
  })

  it('reports a rejected request instead of throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    const { failed } = await preparePosters([movie(1)])
    expect(failed).toEqual(['/poster1.jpg'])
  })
})

describe('DownloadButton', () => {
  it('tells html-to-image to key its image cache by the full URL', async () => {
    render(<DownloadButton grid={fullGrid()} background="#18181b" spacing={8} />)

    await userEvent.click(screen.getByRole('button', { name: /download png/i }))

    await waitFor(() => expect(toPngMock).toHaveBeenCalledTimes(1))
    const options = toPngMock.mock.calls[0][1]
    // Without this, every /api/images?path=… poster shares one cache entry and
    // all nine cells render whichever poster was fetched first.
    expect(options?.includeQueryParams).toBe(true)
    expect(options?.cacheBust).toBe(false)
    expect(typeof options?.onImageErrorHandler).toBe('function')
  })

  it('fetches each poster once before capturing', async () => {
    render(<DownloadButton grid={fullGrid()} background="#18181b" spacing={8} />)

    await userEvent.click(screen.getByRole('button', { name: /download png/i }))

    await waitFor(() => expect(toPngMock).toHaveBeenCalled())
    const imageRequests = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/images'))
    expect(imageRequests).toHaveLength(9)
    expect(new Set(imageRequests.map(([url]) => url)).size).toBe(9)
  })

  it('downloads movie-grid.png from the generated data URL', async () => {
    render(<DownloadButton grid={fullGrid()} background="#18181b" spacing={8} />)

    await userEvent.click(screen.getByRole('button', { name: /download png/i }))

    await waitFor(() => expect(toPngMock).toHaveBeenCalled())
    expect(createdAnchors).toHaveLength(1)
    expect(createdAnchors[0].download).toBe('movie-grid.png')
    expect(createdAnchors[0].getAttribute('href')).toBe('data:image/png;base64,AAAA')
  })

  it('aborts with a clear message when a poster cannot be loaded', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(imageResponse(!String(url).includes('poster4'), 512)),
    )
    render(<DownloadButton grid={fullGrid()} background="#18181b" spacing={8} />)

    await userEvent.click(screen.getByRole('button', { name: /download png/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/1 poster could not be loaded/i)
    expect(alert).toHaveTextContent('Film 4')
    expect(toPngMock).not.toHaveBeenCalled()
  })

  it('surfaces an error raised while inlining images', async () => {
    toPngMock.mockRejectedValue(new Error('A poster image could not be read during export.'))
    render(<DownloadButton grid={fullGrid()} background="#18181b" spacing={8} />)

    await userEvent.click(screen.getByRole('button', { name: /download png/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/export failed/i)
  })

  it('captures data URLs, not network URLs', async () => {
    const { container } = render(
      <DownloadButton grid={fullGrid()} background="#18181b" spacing={8} />,
    )
    expect(container.querySelector('.export-stage img')?.getAttribute('src')).toContain(
      '/api/images',
    )

    await userEvent.click(screen.getByRole('button', { name: /download png/i }))

    await waitFor(() => expect(toPngMock).toHaveBeenCalledTimes(1))
    // html-to-image caches inlined images by URL with the query string
    // stripped, so all nine /api/images?path=… posters would share one entry.
    // Data URLs are skipped by that cache, so every cell keeps its own poster.
    const sources = Array.from(
      container.querySelectorAll('.export-stage img'),
      (img) => img.getAttribute('src'),
    )
    expect(sources).toHaveLength(9)
    for (const src of sources) expect(src).toMatch(/^data:/)
  })

  it('stays disabled until all nine slots are filled', async () => {
    const partial: Grid = [...fullGrid().slice(0, 8), null]
    render(<DownloadButton grid={partial} background="#18181b" spacing={8} />)

    expect(screen.getByRole('button', { name: /download png/i })).toBeDisabled()
    expect(screen.getByText(/fill all nine slots/i)).toBeInTheDocument()
  })
})
