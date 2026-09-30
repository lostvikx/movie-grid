import type { Movie } from '../types/movie'

/**
 * All TMDB access goes through our own FastAPI backend (`/api`), which keeps
 * the API key on the server and serves poster images from the same origin so
 * the PNG export is never blocked by cross-origin canvas rules.
 */
const API_BASE = '/api'

type MovieResult = {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  overview?: string
  vote_average?: number
}

type SearchResponse = {
  results?: MovieResult[]
  error?: string
}

type DetailsResponse = MovieResult & { error?: string }

/** Session-scoped cache so re-opening a movie never re-requests details. */
const detailsCache = new Map<number, Movie>()

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Could not reach the movie server. Is it running?')
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new ApiError(message)
  }

  const data = (await response.json()) as T & { error?: string }
  if (data.error) throw new ApiError(data.error)
  return data
}

function toMovie(result: MovieResult): Movie {
  return {
    id: result.id,
    title: result.title,
    release_date: result.release_date ?? '',
    poster_path: result.poster_path ?? null,
    overview: result.overview,
    vote_average: result.vote_average,
  }
}

export async function searchMovies(
  query: string,
  signal?: AbortSignal,
): Promise<Movie[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const data = await request<SearchResponse>(
    `/search?q=${encodeURIComponent(trimmed)}`,
    signal,
  )
  return (data.results ?? []).slice(0, 10).map(toMovie)
}

export async function getMovieDetails(
  id: number,
  signal?: AbortSignal,
): Promise<Movie> {
  const cached = detailsCache.get(id)
  if (cached) return cached
  const movie = toMovie(await request<DetailsResponse>(`/movie/${id}`, signal))
  detailsCache.set(id, movie)
  return movie
}

export function clearDetailsCache(): void {
  detailsCache.clear()
}

/** Poster URLs are proxied through the backend; null paths fall back locally. */
export function getPosterUrl(path: string | null | undefined): string {
  if (!path) return ''
  return `${API_BASE}/images?path=${encodeURIComponent(path)}`
}

export function getReleaseYear(movie: Movie): string {
  return movie.release_date ? movie.release_date.slice(0, 4) : '—'
}
