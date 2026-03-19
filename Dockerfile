FROM node:22-slim

WORKDIR /app

# Copy shared types and data
COPY shared/ ./shared/
COPY data/ ./data/

# Install server deps
COPY server/package.json ./server/
RUN cd server && npm install

# Copy server source
COPY server/*.ts ./server/

EXPOSE 8080
ENV PORT=8080

WORKDIR /app/server
CMD ["npx", "tsx", "index.ts"]
