"""Movie Grid backend.

A thin proxy in front of TMDB:

* ``/api/search``      movie search
* ``/api/movie/{id}``  full movie details
* ``/api/images``      poster images, served from this origin

Keeping the API key on the server means it is never shipped to the browser, and
serving posters from the same origin keeps the canvas untainted so the frontend
can export the grid as a PNG.

It also serves the built frontend (``app/dist``) when that directory exists, so
a single process can host the whole app.
"""

from .main import app

__all__ = ["app"]
