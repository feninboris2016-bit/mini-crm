# Multi-stage Dockerfile for Mini-CRM
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/server/db/schema.sql ./server/db/schema.sql

# Create persistent data directory
RUN mkdir -p /app/data /app/data/backups

EXPOSE 3000

CMD ["node", "dist-server/index.js"]
