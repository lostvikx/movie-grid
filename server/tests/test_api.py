"""Tests for the TMDB proxy endpoints (no network access, no real API key)."""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from movie_grid_server.main import app

client = TestClient(app)


class FakeResponse:
    def __init__(self, status_code=200, payload=None, content=b"", content_type="image/jpeg"):
        self.status_code = status_code
        self._payload = payload or {}
        self.content = content
        self.headers = {"content-type": content_type}

    def json(self):
        return self._payload


@pytest.fixture
def tmdb_key(monkeypatch):
    monkeypatch.setenv("TMDB_API_KEY", "test-key")
    return "test-key"


@pytest.fixture
def fake_tmdb(monkeypatch):
    """Replace httpx.AsyncClient so no request ever leaves the process."""
    calls: list[str] = []

    def install(handler):
        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc_info):
                return False

            async def get(self, url, params=None, headers=None):
                calls.append(url)
                return handler(url, params, headers)

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
        return calls

    return install


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_search_returns_normalised_results(tmdb_key, fake_tmdb):
    calls = fake_tmdb(
        lambda url, params, headers: FakeResponse(
            payload={
                "results": [
                    {
                        "id": 1,
                        "title": "Dune",
                        "release_date": "2021-09-15",
                        "poster_path": "/dune.jpg",
                        "overview": "Spice must flow.",
                        "vote_average": 8.1,
                    }
                ]
            }
        )
    )

    response = client.get("/api/search", params={"q": "dune"})

    assert response.status_code == 200
    assert response.json()["results"][0]["title"] == "Dune"
    assert "/search/movie" in calls[0]


def test_search_rejects_blank_query():
    assert client.get("/api/search", params={"q": ""}).status_code == 422


def test_search_surfaces_tmdb_errors(tmdb_key, fake_tmdb):
    fake_tmdb(lambda url, params, headers: FakeResponse(status_code=401))

    response = client.get("/api/search", params={"q": "dune"})

    assert response.status_code == 502
    assert "API key" in response.json()["detail"]


def test_search_without_api_key_returns_502(monkeypatch):
    monkeypatch.delenv("TMDB_API_KEY", raising=False)

    response = client.get("/api/search", params={"q": "dune"})

    assert response.status_code == 502
    assert "TMDB_API_KEY" in response.json()["detail"]


def test_movie_details(tmdb_key, fake_tmdb):
    fake_tmdb(
        lambda url, params, headers: FakeResponse(
            payload={"id": 42, "title": "Heat", "release_date": "1995-12-15", "poster_path": None}
        )
    )

    response = client.get("/api/movie/42")

    assert response.status_code == 200
    assert response.json() == {
        "id": 42,
        "title": "Heat",
        "release_date": "1995-12-15",
        "poster_path": None,
        "overview": "",
        "vote_average": None,
    }


def test_image_is_proxied_from_this_origin(tmdb_key, fake_tmdb):
    calls = fake_tmdb(
        lambda url, params, headers: FakeResponse(content=b"image-bytes", content_type="image/jpeg")
    )

    response = client.get("/api/images", params={"path": "/abc.jpg"})

    assert response.status_code == 200
    assert response.content == b"image-bytes"
    assert response.headers["content-type"] == "image/jpeg"
    assert "max-age" in response.headers["cache-control"]
    assert calls[0] == "https://image.tmdb.org/t/p/w500/abc.jpg"


@pytest.mark.parametrize("path", ["abc.jpg", "/../../etc/passwd.jpg", "/abc.exe"])
def test_image_rejects_unsafe_paths(path, tmdb_key):
    assert client.get("/api/images", params={"path": path}).status_code == 400


def test_image_rejects_unknown_size(tmdb_key):
    assert client.get("/api/images", params={"path": "/a.jpg", "size": "huge"}).status_code == 422


def test_search_retries_transient_connection_errors(tmdb_key, fake_tmdb):
    """A single reset connection must not surface as a user-facing error."""
    attempts = {"n": 0}

    def handler(url, params, headers):
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise httpx.ConnectError("connection reset")
        return FakeResponse(payload={"results": [{"id": 7, "title": "Alien"}]})

    fake_tmdb(handler)

    response = client.get("/api/search", params={"q": "alien"})

    assert response.status_code == 200
    assert response.json()["results"][0]["title"] == "Alien"
    assert attempts["n"] == 2


def test_search_gives_up_after_retries_are_exhausted(tmdb_key, fake_tmdb):
    attempts = {"n": 0}

    def handler(url, params, headers):
        attempts["n"] += 1
        raise httpx.ConnectError("connection reset")

    fake_tmdb(handler)

    response = client.get("/api/search", params={"q": "alien"})

    assert response.status_code == 502
    assert attempts["n"] == 4
