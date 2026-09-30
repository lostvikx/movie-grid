import type { Grid, Movie } from '../types/movie'
import { getPosterUrl } from '../services/tmdb'

export type PosterDataUrls = Map<string, string>

export type PreparedPosters = {
  /** Poster path -> data URL, for every poster that loaded. */
  urls: PosterDataUrls
  /** Paths that could not be loaded. */
  failed: string[]
}

/** Poster paths present in the grid, de-duplicated and in slot order. */
export function collectPosterPaths(grid: Grid): string[] {
  const paths: string[] = []
  for (const movie of grid) {
    if (movie?.poster_path && !paths.includes(movie.poster_path)) {
      paths.push(movie.poster_path)
    }
  }
  return paths
}

export function posterTitle(path: string, grid: Grid): string {
  return grid.find((movie: Movie | null) => movie?.poster_path === path)?.title ?? path
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the poster image.'))
    reader.onloadend = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

/**
 * Download every poster in the grid and hand back data URLs.
 *
 * The export deliberately does *not* point <img> at the network URLs:
 *
 * - `html-to-image` caches inlined images in a module-level map keyed by the
 *   URL with the query string stripped, so every `/api/images?path=…` poster
 *   would share one entry and all nine cells would render whichever poster was
 *   fetched first. It skips data URLs entirely, so this sidesteps that cache.
 * - It also stops the export depending on whether the <img> happened to load.
 *   A poster that errored once would otherwise sit on its placeholder forever,
 *   because a failed fetch is cached as an empty string for the whole session.
 * - Each poster is fetched once here instead of twice (once by the browser,
 *   once more by `html-to-image`).
 */
export async function preparePosters(grid: Grid): Promise<PreparedPosters> {
  const results = await Promise.all(
    collectPosterPaths(grid).map(
      async (path): Promise<{ path: string; dataUrl?: string }> => {
        try {
          const response = await fetch(getPosterUrl(path))
          if (!response.ok) return { path }
          const blob = await response.blob()
          if (blob.size === 0) return { path }
          return { path, dataUrl: await blobToDataUrl(blob) }
        } catch {
          return { path }
        }
      },
    ),
  )

  const urls: PosterDataUrls = new Map()
  const failed: string[] = []
  for (const { path, dataUrl } of results) {
    if (dataUrl) urls.set(path, dataUrl)
    else failed.push(path)
  }
  return { urls, failed }
}
