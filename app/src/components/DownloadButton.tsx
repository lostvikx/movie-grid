import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { isFull } from '../lib/grid'
import type { Grid } from '../types/movie'
import { GridCanvas, MoviePoster } from './MoviePoster'

/** Fixed export width so the PNG size never depends on the viewport. */
const EXPORT_WIDTH = 1200
const FILENAME = 'movie-grid.png'
/** Upper bound on how long we wait for poster images before capturing. */
const IMAGE_TIMEOUT_MS = 10000

type Props = {
  grid: Grid
  background: string
  spacing: number
}

type Status = 'idle' | 'working' | 'error'

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'))
  const timeout = new Promise<void>((resolve) =>
    window.setTimeout(resolve, IMAGE_TIMEOUT_MS),
  )
  await Promise.race([
    Promise.all(
      images.map((image) => {
        if (image.complete) return Promise.resolve()
        return new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => resolve(), { once: true })
        })
      }),
    ),
    timeout,
  ])
}

export function DownloadButton({ grid, background, spacing }: Props) {
  const exportRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const ready = isFull(grid)

  async function handleDownload() {
    const node = exportRef.current
    if (!node || !ready) return
    setStatus('working')
    setMessage(null)

    try {
      await waitForImages(node)
      const dataUrl = await toPng(node, {
        pixelRatio: 1,
        width: EXPORT_WIDTH,
        cacheBust: false,
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
                  <MoviePoster movie={movie} eager />
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
