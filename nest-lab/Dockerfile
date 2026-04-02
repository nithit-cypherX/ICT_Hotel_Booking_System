# Stage 1: The Prep Area (Builder)
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate the Prisma client before building the NestJS code
RUN npx prisma generate
RUN npm run build

# Stage 2: The Serving Area (Production)
FROM node:24-alpine

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S nestgroup && adduser -S nestuser -G nestgroup

COPY package*.json ./
COPY prisma ./prisma

# Step A: Install ALL dependencies (so we get YOUR exact Prisma version)
# Step B: Generate the Prisma client
# Step C: Prune (remove) the dev files to keep the image under 300MB!
RUN npm ci && npx prisma generate && npm prune --omit=dev

# NOW we set the environment to production!
ENV NODE_ENV=production

# Copy the compiled code from Stage 1
COPY --from=builder /app/dist ./dist

# Switch to the secure user
USER nestuser
EXPOSE 3000

# Point to the nested main.js path
CMD ["node", "dist/src/main.js"]