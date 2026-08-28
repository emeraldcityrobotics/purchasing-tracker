# syntax=docker/dockerfile:1

# ---- Frontend build ----
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend build ----
FROM node:22-bookworm-slim AS backend-build
WORKDIR /app/backend
# better-sqlite3 needs to compile its native binding if no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build
RUN npm prune --omit=dev

# ---- Runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=backend-build /app/backend/package.json ./package.json
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist/frontend/browser ./frontend/browser

# Writable location for the SQLite file; mount a volume here to persist data.
RUN mkdir -p /app/data && chown -R node:node /app
ENV DATABASE_PATH=/app/data/purchasing.db
ENV FRONTEND_DIST_PATH=/app/backend/frontend/browser
ENV PORT=3000

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/auth/check').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
