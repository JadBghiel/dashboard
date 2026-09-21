# the graded image: next + just enough of the prisma cli for the entrypoint to migrate.
# multi stage so the dev deps

FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: full install, dev deps included bc next build needs them
FROM base AS deps
# prisma is in postinstall, it needs the schema before npm ci runs
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ---- the prisma cli on its own, only so the entrypoint can migrate. npm resolves its closure,
# picking the packages by hand breaks the day a transitive dep changes
FROM base AS prisma-cli
WORKDIR /opt/prisma
COPY package.json ./project-package.json
RUN npm init -y > /dev/null \
  && npm install --omit=dev --no-audit --no-fund \
    "prisma@$(node -p "require('./project-package.json').devDependencies.prisma")" \
  && rm project-package.json

# ---- build: the standalone server
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# generated/ is gitignored and dockerignored, so the client is built here for this platform
RUN npx prisma generate && npm run build

# ---- runner: what actually ships
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# prisma engines are linked against openssl, the slim image doesnt ship it
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# standalone brings its own minimal node_modules, static is not traced so it comes separately
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# the migration side: schema, migrations, config and the cli. it lands in the same node_modules as
# the traced ones so prisma.config.ts can still resolve "prisma/config" from /app
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=prisma-cli /opt/prisma/node_modules ./node_modules

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && chown -R node:node /app

# the node user ships w/ the image, nothing here needs root
USER node
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
