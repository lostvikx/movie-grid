import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useMovieSearch } from './useMovieSearch'
import { clearDetailsCache, getMovieDetails, getPosterUrl } from '../services/tmdb'
import type { Movie } from '../types/movie'

function result(id: number, title: string): Movie {
  return { id, title, release_date: '2001-01-01', poster_path: `/p${id}.jpg` }
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  clearDetailsCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useMovieSearch', () => {
  it('does not request anything for a blank query', async () => {
    const { result: hook } = renderHook(() => useMovieSearch('   '))
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(hook.current.results).toEqual([])
    expect(hook.current.loading).toBe(false)
  })

  it('debounces by 300ms and returns results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [result(1, 'A')] }))
    const { result: hook } = renderHook(() => useMovieSearch('dune'))

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await waitFor(() => expect(hook.current.results).toHaveLength(1))
    expect(hook.current.results[0].title).toBe('A')
    expect(hook.current.loading).toBe(false)
  })

  it('caps results at ten entries', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ results: Array.from({ length: 25 }, (_, i) => result(i, `M${i}`)) }),
    )
    const { result: hook } = renderHook(() => useMovieSearch('a'))
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    await waitFor(() => expect(hook.current.results).toHaveLength(10))
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    let resolveFirst: ((value: Response) => void) | undefined
    fetchMock
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce(jsonResponse({ results: [result(2, 'Newer')] }))

    const { result: hook, rerender } = renderHook(
      ({ q }: { q: string }) => useMovieSearch(q),
      { initialProps: { q: 'old' } },
    )

    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    rerender({ q: 'new' })
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    await waitFor(() => expect(hook.current.results[0]?.title).toBe('Newer'))

    // The slow first request finishes last and must not overwrite the results.
    await act(async () => {
      resolveFirst?.(jsonResponse({ results: [result(1, 'Stale')] }))
      await Promise.resolve()
    })
    expect(hook.current.results[0]?.title).toBe('Newer')
  })

  it('surfaces API errors and stops loading', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status_message: 'Invalid key' }, 401))
    const { result: hook } = renderHook(() => useMovieSearch('bad'))
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    await waitFor(() => expect(hook.current.error).toBeTruthy())
    expect(hook.current.loading).toBe(false)
    expect(hook.current.results).toEqual([])
  })

  it('reports an empty result set', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    const { result: hook } = renderHook(() => useMovieSearch('zzzz'))
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    await waitFor(() => expect(hook.current.loading).toBe(false))
    expect(hook.current.results).toEqual([])
    expect(hook.current.error).toBeNull()
  })
})

describe('tmdb service', () => {
  it('builds poster URLs and handles null paths', () => {
    expect(getPosterUrl('/abc.jpg')).toBe('/api/images?path=%2Fabc.jpg')
    expect(getPosterUrl(null)).toBe('')
    expect(getPosterUrl(undefined)).toBe('')
  })

  it('caches details per session', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 5, title: 'Heat', release_date: '1995-12-15', poster_path: null }),
    )
    const first = await getMovieDetails(5)
    const second = await getMovieDetails(5)
    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
