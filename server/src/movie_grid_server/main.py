"""FastAPI application: TMDB proxy endpoints plus static frontend hosting."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .tmdb import (
    POSTER_SIZE,
    TMDB_IMAGE_BASE,
    TmdbError,
    client_kwargs,
    fetch_json,
    get_with_retry,
    normalise_movie,
    validate_image_path,
)

FRONTEND_DIST = Path(
    os.environ.get(
        "FRONTEND_DIST",
        Path(__file__).resolve().parents[3] / "app" / "dist",
    )
)

IMAGE_CACHE_CONTROL = "public, max-age=86400, immutable"

app = FastAPI(title="Movie Grid API", version="1.0.0")

# The Vite dev server runs on a different port, so dev requests are cross-origin.
# In production the frontend is served from this same origin and CORS is unused.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"status": "ok"}


@app.get("/api/search")
async def search_movies(
    q: str = Query(min_length=1, description="Movie title to search for"),
    limit: int = Query(10, ge=1, le=50),
) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=10.0, **client_kwargs()) as client:
            data = await fetch_json(
                client, "/search/movie", {"query": q, "include_adult": "false"}
            )
    except TmdbError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    results = data.get("results") or []
    return {"results": [normalise_movie(item) for item in results[:limit]]}


@app.get("/api/movie/{movie_id}")
async def movie_details(movie_id: int) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=10.0, **client_kwargs()) as client:
            data = await fetch_json(client, f"/movie/{movie_id}")
    except TmdbError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return normalise_movie(data)


@app.get("/api/images")
async def movie_image(
    path: str = Query(description="TMDB image path, e.g. /abc123.jpg"),
    size: str = Query(POSTER_SIZE, pattern="^(w185|w342|w500|original)$"),
) -> Response:
    """Stream a TMDB image from this origin so the browser can draw it to canvas."""
    try:
        safe_path = validate_image_path(path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    url = f"{TMDB_IMAGE_BASE}/{size}{safe_path}"
    async with httpx.AsyncClient(timeout=15.0, **client_kwargs()) as client:
        upstream = await get_with_retry(client, url)

    if upstream.status_code >= 400:
        raise HTTPException(status_code=upstream.status_code, detail="Image not found.")

    return Response(
        content=upstream.content,
        media_type=upstream.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": IMAGE_CACHE_CONTROL},
    )


def mount_frontend() -> None:
    """Serve the built frontend if it exists; otherwise run the API only."""
    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        return

    assets = FRONTEND_DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str) -> FileResponse:
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


mount_frontend()
