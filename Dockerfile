# Stage 1: deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Stage 2: final
FROM node:22-alpine AS runner
RUN addgroup -S civicresolve && adduser -S -G civicresolve civicresolve
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=civicresolve:civicresolve . .
USER civicresolve
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/healthz || exit 1
CMD ["node","server.js"]
