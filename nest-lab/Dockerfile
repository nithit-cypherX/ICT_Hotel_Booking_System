# =========================================================================
# Hotel Booking REST API — Production Dockerfile
# -------------------------------------------------------------------------
# Multi-stage build:
#   Stage 1 (deps)    → install ALL deps (needed for Prisma generate + build)
#   Stage 2 (builder) → generate Prisma client, compile TypeScript → dist/
#   Stage 3 (runner)  → lean production image: node_modules (prod only) + dist
#
# Satisfies: FR-35, NFR-18, NFR-19
# =========================================================================

# ---- Stage 1: install dependencies --------------------------------------
FROM node:20-alpine AS deps

# libc6-compat is required by some native modules (bcrypt, Prisma engines)
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy only the manifests first so Docker can cache this layer
COPY package.json package-lock.json* ./

# Install all deps (dev + prod) — needed to compile TypeScript
RUN npm ci


# ---- Stage 2: build the app ---------------------------------------------
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Bring in installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source tree
COPY . .

# Generate Prisma client (schema is in prisma/) so dist/ can import it
RUN ./node_modules/.bin/prisma generate

# Compile TypeScript → dist/
RUN npm run build

# Strip dev dependencies to shrink the final image
RUN npm prune --omit=dev


# ---- Stage 3: runtime ---------------------------------------------------
FROM node:20-alpine AS runner

# Install a tiny init so Node.js receives SIGTERM cleanly (graceful shutdown)
RUN apk add --no-cache libc6-compat openssl tini wget

WORKDIR /app

# Run as a non-root user (security hardening, NFR-4)
RUN addgroup -S nodejs && adduser -S nestuser -G nodejs

# Copy ONLY what the runtime needs — keeps the image small
COPY --from=builder --chown=nestuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestuser:nodejs /app/dist          ./dist
COPY --from=builder --chown=nestuser:nodejs /app/prisma        ./prisma
COPY --from=builder --chown=nestuser:nodejs /app/package.json  ./package.json

# Create uploads directory for room images (FR-14) and give it to the app user
RUN mkdir -p /app/uploads && chown -R nestuser:nodejs /app/uploads

USER nestuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Container-level health check (also used by docker compose)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# tini -> node keeps PID 1 responsive to signals
ENTRYPOINT ["/sbin/tini", "--"]

# Apply DB migrations first, then start the compiled server.
# `migrate deploy` is the production-safe command (no interactive prompts).
CMD ["sh", "-c", "npx prisma@5.22.0 migrate deploy && node dist/src/main.js"]
