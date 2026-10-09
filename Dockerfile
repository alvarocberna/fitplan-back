# Imagen de producción del backend. Debian (glibc) y no Alpine: @napi-rs/canvas y los motores de
# Prisma funcionan sin ajustes.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package*.json ./
# node_modules completo a propósito: incluye el CLI de Prisma para `prisma migrate deploy`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# El código compilado importa el cliente de Prisma por ruta relativa: generated/ va junto a dist/.
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
USER node
EXPOSE 3001
CMD ["node", "dist/main"]
