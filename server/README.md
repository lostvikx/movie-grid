# Movie Grid server

A small FastAPI service that proxies [TMDB](https://www.themoviedb.org) so the
browser never needs the API key and poster images are same-origin (which is what
makes the PNG export work).

## Run

From the repository root:

```bash
uv run --project server --env-file .env uvicorn movie_grid_server.main:app --reload
```

The API listens on <http://127.0.0.1:8000> and its docs are at
<http://127.0.0.1:8000/docs>.

If `app/dist` exists it is served as a static site, so one process can host the
whole application.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `TMDB_API_KEY` | — | Required. TMDB API key or read access token. |
| `TMDB_VERIFY_TLS` | `true` | Set `false` only if your network breaks Python's TLS handshake. Disables certificate checks. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins. |
| `FRONTEND_DIST` | `app/dist` | Built frontend to serve. |

## Layout

```text
src/movie_grid_server/
  main.py    FastAPI app: endpoints, CORS, static frontend
  tmdb.py    HTTP access, API-key handling, response normalisation, retries
tests/       Endpoint tests (no network, no real key)
```

## Tests

```bash
uv run --project server pytest
```

## Behaviour worth knowing

* `/api/images` only accepts TMDB paths — it must start with `/`, contain no
  `..`, and end in a known image extension, so the endpoint cannot be used to
  fetch arbitrary URLs.
* Search returns at most 50 results; the frontend asks for 10.
* Connection errors are retried up to three times, because some networks reset
  TLS connections intermittently.
