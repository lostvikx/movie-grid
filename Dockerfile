# Build the frontend, then serve everything from FastAPI on one port.
FROM node:22-alpine AS frontend
WORKDIR /build
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build


FROM python:3.12-slim AS runtime
WORKDIR /srv
COPY --from=ghcr.io/astral-sh/uv:0.12.19 /uv /uvx /bin/
COPY server/pyproject.toml server/uv.lock server/README.md ./
COPY server/src ./src
RUN uv sync --no-dev --frozen

COPY --from=frontend /build/dist ./dist

ENV FRONTEND_DIST=/srv/dist
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "movie_grid_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
