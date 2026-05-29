# ---- Build ----
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# DATABASE_URL dummy SOLO para el build: src/db/client.ts hace throw si la
# variable no existe al importarse, y en el build no hay base disponible.
# NO se conecta a esta URL durante el build (las páginas son force-dynamic;
# no se ejecuta ninguna query). En runtime el valor REAL llega por env_file.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npm run build

# ---- Runtime ----
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
