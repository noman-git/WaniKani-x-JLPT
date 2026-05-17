FROM node:20-alpine AS base

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle

# One-off maintenance scripts (run via `docker exec ... npx tsx scripts/...`).
# tsx is installed globally so the script's .ts source needs no precompile.
COPY --from=builder /app/scripts ./scripts
RUN npm install -g tsx@4

# Copy seed database (will be used if no DB exists on the volume)
RUN mkdir -p /app/seed
COPY --from=builder /app/data/jlpt-seed.db ./seed/

# Set ownership for data directory (will be a volume mount)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
