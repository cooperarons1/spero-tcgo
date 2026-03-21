# ── Build stage ──
FROM node:22-slim AS builder

WORKDIR /app

# Copy shared types and data
COPY shared/ ./shared/
COPY data/ ./data/

# Install all server deps (including devDependencies for tsc)
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install

# Copy server source and compile
COPY server/*.ts ./server/
COPY server/tsconfig.json ./server/
RUN cd server && npx tsc --rootDir .. --outDir dist

# ── Runtime stage ──
FROM node:22-slim

RUN adduser --system app

WORKDIR /app

# Copy compiled JS and data
COPY --from=builder /app/server/dist/server/ ./server/
COPY --from=builder /app/server/dist/shared/ ./shared/
COPY data/ ./data/

# Install production deps only
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev

USER app

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

WORKDIR /app/server
CMD ["node", "index.js"]
