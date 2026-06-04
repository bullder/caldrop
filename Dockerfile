# DROP Data Broker API emulator (Next.js)
FROM node:22-slim AS base
WORKDIR /app

# Install deps first (cached unless lockfile changes).
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Build the standalone Next.js server.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runtime image.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Seed personal.csv into the image so /data/download works out of the box.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
RUN node_modules/.bin/tsx scripts/seed.ts

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# API keys come from the runtime env (-e API_KEYS=... or --env-file .env).
CMD ["node", "server.js"]
