# syntax=docker/dockerfile:1

FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY dashboard/package.json dashboard/package.json
COPY packages/widget/package.json packages/widget/package.json
RUN npm ci

COPY . .

# The dashboard bakes its API origin in at build time - the embed snippet it shows
# customers needs an absolute URL, since it's pasted onto a *different* site.
ARG VITE_API_BASE=http://localhost:4000
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build --workspace packages/widget \
  && npm run build --workspace dashboard \
  && npm run build --workspace server

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY dashboard/package.json dashboard/package.json
COPY packages/widget/package.json packages/widget/package.json
RUN npm ci --omit=dev

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/migrations server/migrations
COPY --from=build /app/dashboard/dist dashboard/dist
COPY --from=build /app/packages/widget/dist packages/widget/dist

EXPOSE 4000
CMD ["sh", "-c", "node server/dist/migrate.js && node server/dist/index.js"]
