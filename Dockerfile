# Build the frontend, then serve everything from FastAPI on one port.
FROM node:22-alpine AS frontend
WORKDIR /build
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build


FROM python:3.12-slim AS runtime
WORKDIR /srv

# uv, for a fast and reproducible dependency install.
COPY --from=ghcr.io/astral-sh/uv:0.12.19 /uv /uvx /bin/

COPY server/pyproject.toml server/uv.lock server/README.md ./
COPY server/src ./src
RUN uv sync --frozen --no-dev

# The built SPA, served by the same process.
COPY --from=frontend /build/dist ./dist

ENV FRONTEND_DIST=/srv/dist
# Render and most PaaS providers inject the port they expect the service on.
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8000') + '/api/health').read()"

# Shell form so $PORT expands.
CMD ["sh", "-c", "exec uv run --no-sync uvicorn movie_grid_server.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
