# ── Taccuino — production image ────────────────────────────────
# Build:  docker build -t taccuino .
# Run:    docker run -d -p 3000:3000 -v taccuino-data:/app/db taccuino

FROM oven/bun:1

WORKDIR /app

# Install dependencies first — this layer is cached between builds
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the application source
COPY . .

# Build the standalone production bundle.
# DATABASE_URL is only needed at build time so Prisma can resolve the
# datasource; the actual database file is (re)created at startup.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/app/db/custom.db
RUN mkdir -p /app/db \
    && bunx prisma generate \
    && bunx prisma db push --accept-data-loss \
    && bun run build

# ── Runtime ────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/db/custom.db

EXPOSE 3000

# Apply the schema (idempotent — handles fresh volumes too) and start.
# On first request with an empty database the workspace self-seeds
# with a few demo pages.
CMD ["sh", "-c", "bunx prisma db push --accept-data-loss --skip-generate && bun .next/standalone/server.js"]
