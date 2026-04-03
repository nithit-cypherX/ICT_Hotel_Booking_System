# ─── STAGE 1: BUILDER ──────────────────────────────────────────
FROM node:20-alpine AS builder

# Prisma needs these on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy dependency files first (better caching)
COPY package*.json ./

# Install ALL deps (needed for build + prisma)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client (uses version from package.json)
RUN npx prisma generate

# Build NestJS app
RUN npm run build


# ─── STAGE 2: PRODUCTION ───────────────────────────────────────
FROM node:20-alpine

# Install required system libs again (runtime requirement)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Create non-root user (security best practice)
RUN addgroup -S nestgroup && adduser -S nestuser -G nestgroup

# Copy only what's needed
COPY package*.json ./
COPY prisma ./prisma

# Install deps → generate prisma → prune dev deps
RUN npm ci \
  && npx prisma generate \
  && npm prune --omit=dev

# Set production mode
ENV NODE_ENV=production

# Copy compiled app
COPY --from=builder /app/dist ./dist

# Switch to non-root user
USER nestuser

EXPOSE 3000

CMD ["node", "dist/src/main.js"]