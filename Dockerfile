FROM node:24-alpine AS base
RUN npm install -g pnpm@10.32.0
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=1000:1000 package.json ./
COPY --chown=1000:1000 --from=prod-deps /app/node_modules ./node_modules
COPY --chown=1000:1000 --from=build /app/dist ./dist
COPY --chown=1000:1000 migrations ./migrations
COPY --chown=1000:1000 guide ./guide
USER 1000
EXPOSE 3000
# Migrations run before the server binds the port. exec lets node get SIGTERM.
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/server.js"]
