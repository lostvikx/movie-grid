"""TMDB access: HTTP calls, the API key, and response normalisation."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx

TMDB_API_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"
POSTER_SIZE = "w500"
LANGUAGE = "en-US"

# The image path always starts with a slash; anything else is rejected so the
# endpoint cannot be used to fetch arbitrary URLs.
_ALLOWED_IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp")


class TmdbError(Exception):
    """Raised when TMDB is unreachable, rejects the key, or returns an error."""


def tls_verify() -> bool:
    """Certificate verification, with an opt-out for locked-down networks.

    Some networks (TLS-inspecting proxies, certain ISPs) reset the handshake for
    Python's TLS stack while browsers succeed. Set ``TMDB_VERIFY_TLS=false`` only
    as a local workaround — it disables certificate checking.
    """
    return os.environ.get("TMDB_VERIFY_TLS", "true").strip().lower() not in {
        "0",
        "false",
        "no",
    }


def client_kwargs() -> dict[str, Any]:
    return {"verify": tls_verify()}


# Some networks intermittently reset TLS connections; retry a few times before
# giving up so a single blip does not surface as a user-facing error.
MAX_ATTEMPTS = 4
RETRY_DELAY_SECONDS = 0.5


async def get_with_retry(
    client: httpx.AsyncClient, url: str, **kwargs: Any
) -> httpx.Response:
    last_error: httpx.HTTPError | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return await client.get(url, **kwargs)
        except httpx.HTTPError as exc:
            last_error = exc
            if attempt < MAX_ATTEMPTS:
                await asyncio.sleep(RETRY_DELAY_SECONDS * attempt)
    raise TmdbError("Could not reach TMDB. Please try again.") from last_error


def get_api_key() -> str:
    key = os.environ.get("TMDB_API_KEY", "").strip()
    if not key:
        raise TmdbError(
            "TMDB_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    return key


def is_access_token(key: str) -> bool:
    """Read Access Tokens are JWTs; plain v3 keys are sent as a query param."""
    return key.count(".") == 2


def _auth(key: str) -> tuple[dict[str, str], dict[str, str]]:
    if is_access_token(key):
        return {"Authorization": f"Bearer {key}"}, {}
    return {}, {"api_key": key}


async def fetch_json(
    client: httpx.AsyncClient, path: str, params: dict[str, Any] | None = None
) -> dict[str, Any]:
    key = get_api_key()
    headers, auth_params = _auth(key)
    query = {"language": LANGUAGE, **auth_params, **(params or {})}

    try:
        response = await get_with_retry(
            client, f"{TMDB_API_BASE}{path}", params=query, headers=headers
        )
    except TmdbError:
        raise
    except httpx.HTTPError as exc:  # pragma: no cover - defensive
        raise TmdbError("Could not reach TMDB. Please try again.") from exc

    if response.status_code in (401, 403):
        raise TmdbError("TMDB rejected the API key. Check TMDB_API_KEY.")
    if response.status_code == 404:
        raise TmdbError("Not found on TMDB.")
    if response.status_code >= 400:
        raise TmdbError(f"TMDB request failed ({response.status_code}).")

    data = response.json()
    if isinstance(data, dict) and data.get("status_message"):
        raise TmdbError(str(data["status_message"]))
    return data


def normalise_movie(raw: dict[str, Any]) -> dict[str, Any]:
    """Map a TMDB movie object onto the frontend's Movie shape."""
    return {
        "id": raw.get("id"),
        "title": raw.get("title") or raw.get("name") or "Untitled",
        "release_date": raw.get("release_date") or "",
        "poster_path": raw.get("poster_path"),
        "overview": raw.get("overview") or "",
        "vote_average": raw.get("vote_average"),
    }


def validate_image_path(path: str) -> str:
    """Return a safe TMDB image path, or raise ValueError."""
    if not path.startswith("/") or ".." in path or "//" in path:
        raise ValueError("Invalid image path.")
    if not path.lower().endswith(_ALLOWED_IMAGE_SUFFIXES):
        raise ValueError("Unsupported image format.")
    return path
