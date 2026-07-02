# =============================================================================
# ProTrackr — Production Container Image
# =============================================================================
# Multi-stage build:
#   1. base       — node:22-alpine + pnpm via corepack
#   2. deps       — all dependencies (incl. devDependencies for build)
#   3. build      — produces dist/index.js (server) + dist/public/ (frontend)
#   4. prod-deps  — production-only node_modules for runtime
#   5. runtime    — slim final image, non-root user
#
# Target: NAS deployment (Unraid 7.2.5, AOOSTAR WTR MAX 8845, x86_64)
# Exposed port: 3000 (internal). Tailscale Serve maps to external :9443.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base — Node 22 Alpine with pnpm
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base

# Enable corepack and pin pnpm version to match packageManager in package.json
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Dependencies — full install with lockfile fidelity
# -----------------------------------------------------------------------------
FROM base AS deps

# Patches are referenced in package.json pnpm.patchedDependencies
# and must exist BEFORE pnpm install runs.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# --frozen-lockfile ensures reproducible builds (CI-style)
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Build — produce dist/
# -----------------------------------------------------------------------------
FROM deps AS build

# Copy full source. .dockerignore filters out node_modules, dist, logs, .env*
COPY . .

# package.json scripts:
#   prebuild: node scripts/generate-version.js && node scripts/update-version.js
#   build:    vite build (-> dist/public/) && esbuild server/_core/index.ts (-> dist/index.js)
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 4: Production dependencies — slim runtime node_modules
# -----------------------------------------------------------------------------
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# --prod excludes devDependencies; lockfile still enforced.
# --ignore-scripts: the "prepare" script (in package.json) calls husky, which
# is a devDependency and therefore NOT present in --prod. Without this flag,
# pnpm fails with "sh: husky: not found". Lifecycle scripts (postinstall etc.)
# are not needed in the runtime image — the actual build happens in the
# separate build stage above, and bcryptjs (pure JS) is used over bcrypt
# (native), so no native rebuild is required.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 5: Runtime — final slim image with non-root user
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime

# tzdata: Alpine ships NO timezone database, so TZ=Europe/Warsaw (set in
# docker-compose.yml) would silently fall back to UTC and the app would
# format dates in UTC (off-by-one on Warsaw-midnight values). Installing
# tzdata makes the TZ env var resolve, so Node's local timezone == Warsaw,
# matching the mysql container and the notebook.
#
# corepack/pnpm only needed if we want to run pnpm db:push at runtime.
# Kept enabled to allow ad-hoc drizzle-kit migrations via docker exec.
RUN apk add --no-cache tzdata \
 && corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Non-root user (Unraid default UID is 99, but standard non-root 1001 is fine
# because container is isolated from host UIDs unless we map them explicitly
# in docker-compose.yml).
RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S protrackr -G nodejs

# Copy artifacts from previous stages.
#
# NOTE: We deliberately copy node_modules from the `build` stage (with full
# devDependencies installed) instead of the leaner `prod-deps` stage. Reason:
# server/_core/vite.ts has *static* ES-module imports of `vite` and the
# top-level `vite.config`. ES modules evaluate top-level imports at module
# load time regardless of whether the importing function (setupVite) is ever
# called at runtime. In production we use serveStatic, not setupVite — but
# the static import still fires and crashes with ERR_MODULE_NOT_FOUND for
# `vite` if it isn't in node_modules.
#
# Cleanest long-term fix would be to convert these to dynamic imports in
# server/_core/vite.ts (Option A), but that's an app-code change that would
# also need to land on main. For the nas-setup branch we keep the change
# isolated to this Dockerfile by shipping the full node_modules from the
# build stage (adds ~200 MB to the image but is branch-local).
#
# The prod-deps stage above is therefore unused but intentionally kept as
# documentation of the intended slim approach; remove it once dynamic
# imports land in main.
COPY --from=build --chown=protrackr:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=protrackr:nodejs /app/dist          ./dist
COPY --from=build --chown=protrackr:nodejs /app/drizzle       ./drizzle
COPY --chown=protrackr:nodejs package.json drizzle.config.ts ./

USER protrackr

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Server entry produced by esbuild bundle of server/_core/index.ts
CMD ["node", "dist/index.js"]
