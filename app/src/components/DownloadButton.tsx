import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toPng } from 'html-to-image'
import { isFull } from '../lib/grid'
import { posterTitle, preparePosters, type PosterDataUrls } from '../lib/posters'
import type { Grid } from '../types/movie'
import { GridCanvas, MoviePoster } from './MoviePoster'

/** Fixed export width so the PNG size never depends on the viewport. */
const EXPORT_WIDTH = 1200
const FILENAME = 'movie-grid.png'

type Props = {
  grid: Grid
  background: string
  spacing: number
}

type Status = 'idle' | 'working' | 'error'

const NO_URLS: PosterDataUrls = new Map()

export function DownloadButton({ grid, background, spacing }: Props) {
  const exportRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  /** Posters already downloaded as data URLs, ready to be captured. */
  const [posterData, setPosterData] = useState<PosterDataUrls>(NO_URLS)
  const ready = isFull(grid)

  async function handleDownload() {
    const node = exportRef.current
    if (!node || !ready) return
    setStatus('working')
    setMessage(null)

    try {
      // Download every poster first. Nothing is captured from a half-loaded
      // grid: either all nine posters are in hand or the export stops here.
      const { urls, failed } = await preparePosters(grid)
      if (failed.length > 0) {
        setStatus('error')
        setMessage(
          `${failed.length} poster${failed.length > 1 ? 's' : ''} could not be loaded (${failed
            .slice(0, 2)
            .map((path) => posterTitle(path, grid))
            .join(', ')}${failed.length > 2 ? ', …' : ''}). Check your connection and try again.`,
        )
        return
      }

      // Commit the data URLs before capturing, so the clone sees them.
      flushSync(() => setPosterData(urls))

      const dataUrl = await toPng(node, {
        pixelRatio: 1,
        width: EXPORT_WIDTH,
        cacheBust: false,
        // The posters are data URLs by now, so this library never inlines or
        // caches them itself — but keep the full URL key as well, so a poster
        // that falls back to its network URL still cannot collide with another.
        includeQueryParams: true,
        // Turn a silent blank cell into a real error the user can see.
        onImageErrorHandler: () => {
          throw new Error('A poster image could not be read during export.')
        },
      })
      const link = document.createElement('a')
      link.download = FILENAME
      link.href = dataUrl
      link.click()
      setStatus('idle')
    } catch (error) {
      console.error('PNG export failed', error)
      setStatus('error')
      setMessage(
        'Export failed. This usually means a poster image could not be read from TMDB — try again or remove the offending poster.',
      )
    }
  }

  return (
    <section className="panel" aria-labelledby="download-heading">
      <h2 id="download-heading" className="panel-title">
        Export
      </h2>

      <button
        type="button"
        className="button button--primary"
        onClick={handleDownload}
        disabled={!ready || status === 'working'}
      >
        {status === 'working' ? 'Preparing PNG…' : 'Download PNG'}
      </button>

      <p className="panel-hint" role="status">
        {ready
          ? 'All nine slots are filled — ready to download.'
          : 'Fill all nine slots to enable the download.'}
      </p>

      {status === 'error' && message && (
        <p className="panel-error" role="alert">
          {message}
        </p>
      )}

      {/* Dedicated export target: fixed width, off-screen, never interactive. */}
      <div className="export-stage" aria-hidden="true">
        <div ref={exportRef} style={{ width: `${EXPORT_WIDTH}px` }}>
          <GridCanvas
            background={background}
            spacing={spacing}
            className="grid-canvas--export"
            label="Movie grid export"
          >
            {grid.map((movie, index) =>
              movie ? (
                <div className="grid-cell is-filled" key={index}>
                  <MoviePoster
                    movie={movie}
                    eager
                    dataUrl={movie.poster_path ? posterData.get(movie.poster_path) : undefined}
                  />
                </div>
              ) : (
                <div className="grid-cell is-empty" key={index} />
              ),
            )}
          </GridCanvas>
        </div>
      </div>
    </section>
  )
}
