# Movie 3×3 Grid

Search [TMDB](https://www.themoviedb.org), fill a 3×3 poster grid, rearrange the
posters by dragging, customise the background and spacing, and download the grid
as a PNG.

The repository is a small two-part app:

| Directory | What it is | Stack |
| --- | --- | --- |
| [`app/`](app) | The React single-page app | React 19 + TypeScript + Vite, `@dnd-kit`, `html-to-image` |
| [`server/`](server) | A proxy in front of TMDB | FastAPI + `uv` (uvicorn, httpx) |

## Why a backend?

Originally the browser called TMDB directly, which meant the API key had to be
shipped in the public bundle and poster images were cross-origin. The second
point broke PNG export: `html-to-image` draws the grid onto a `<canvas>`, and a
canvas that has drawn a foreign image becomes tainted, so `toBlob()` fails with
a security error.

The backend fixes both:

* `TMDB_API_KEY` stays on the server and is never sent to the browser.
* Posters are served from `/api/images`, the same origin as the app, so the
  export canvas is never tainted.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/search?q=dune&limit=10` | Movie search, normalised to the frontend's `Movie` shape |
| `GET` | `/api/movie/{id}` | Full details for one movie |
| `GET` | `/api/images?path=/abc.jpg&size=w500` | Proxies a TMDB poster (path validated) |
| `GET` | `/` and `/assets/*` | Serves the built frontend from `app/dist` when it exists |

## Setup

Requirements: [Node 20+](https://nodejs.org) and [uv](https://docs.astral.sh/uv/).

```bash
git clone git@github.com:lostvikx/movie-grid.git
cd movie-grid
cp .env.example .env      # then add your TMDB key
```

Get a key from <https://www.themoviedb.org/settings/api> — either the 32-character
**API Key** or the longer **API Read Access Token** both work. Put it in `.env`
as `TMDB_API_KEY=...`. `.env` is gitignored; never commit a real key.

## Run it

Two terminals, or one with `&`:

```bash
# 1. API on http://127.0.0.1:8000
uv run --project server --env-file .env uvicorn movie_grid_server.main:app --reload

# 2. Frontend on http://localhost:5173 (proxies /api to the server)
cd app && npm install && npm run dev
```

Open <http://localhost:5173>. Vite forwards `/api/*` to the FastAPI server, so
the browser only ever talks to one origin in development too.

### Single-process mode

Build the frontend and let FastAPI serve it from the same port:

```bash
cd app && npm run build          # writes app/dist
uv run --project server --env-file .env uvicorn movie_grid_server.main:app
# http://127.0.0.1:8000 now serves the whole app
```

The static routes are mounted at start-up, so restart the server after building
the frontend for the first time.

## Tests

```bash
cd app && npm test        # 44 Vitest tests: grid operations, search, modal, settings, export states
uv run --project server pytest   # 13 FastAPI tests, no network or real key needed
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `TMDB_API_KEY` | — | Required. TMDB API key or read access token. |
| `TMDB_VERIFY_TLS` | `true` | Set to `false` only on networks that break Python's TLS handshake (disables certificate checks). |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated origins allowed by the API. |
| `FRONTEND_DIST` | `app/dist` | Directory of the built frontend to serve. |

## Deployment

GitHub Pages cannot run a Python server, so the app is deployed as a single
container instead:

```bash
docker build -t movie-grid .
docker run -p 8000:8000 -e TMDB_API_KEY=your_key movie-grid
```

The image builds the frontend and serves it from FastAPI on a single port, which
suits any container host (Fly.io, Railway, Render, Cloud Run, a VPS). Two things
to remember on a real deployment:

* Set `CORS_ORIGINS` to your site origin, or drop it if the app and API share an
  origin (the default setup).
* Add TMDB attribution and follow
  [TMDB's terms of use](https://www.themoviedb.org/tos), which ask you to link
  back to TMDB.

## Scope

No accounts, no database, no grid persistence — the grid lives in browser state
for the current session only.
