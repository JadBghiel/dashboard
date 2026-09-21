# Dashboard

A customizable dashboard that gathers information from services you already use, weather, GitHub, Spotify, RSS feeds and the stock market, into widgets that refresh on their own schedule.

## AVAILABLE ONLINE ON VERCEL: [DASHBOARD](https://dashboard-jad-nico.vercel.app/)

## Requirements

- Node.js 22 or later (see `.nvmrc`)
- Docker and Docker Compose

## Getting started

```bash
npm install
npm run setup
npm run dev
```

The app runs at http://localhost:3000

`npm run setup` creates `.env.local`, starts Postgres in Docker, applies the migrations and seeds two
accounts. It is safe to rerun, and it is also how you start the database again after a reboot. To stop
it: `docker compose -f docker-compose.dev.yml down`.

| Account | Email                  | Password              |
| ------- | ---------------------- | --------------------- |
| Admin   | `admin@dashboard.test` | `dashboard-admin-dev` |
| Demo    | `demo@dashboard.test`  | `dashboard-demo-dev`  |

These accounts only exist in your local database. The seed refuses to run against anything else.

The API lives under `/api`. Its reference is at http://localhost:3000/api/docs and the OpenAPI
document it reads is at http://localhost:3000/api/openapi.json, both generated from the same schemas
the server validates with.

## Running the whole stack in Docker

```bash
docker compose build
docker compose up
```

The server answers on http://localhost:8080 and migrations run on startup. This stack is separate
from the development one: `docker-compose.dev.yml` only holds the databases, while
`docker-compose.yml` builds and runs the app itself.

## Scripts

| Script               | What it does                                               |
| -------------------- | ---------------------------------------------------------- |
| `npm run setup`      | Env file, database, migrations and seed                    |
| `npm run dev`        | Development server on port 3000                            |
| `npm run db:migrate` | Create and apply a migration after a schema change         |
| `npm run db:reset`   | Wipe the local database, reapply the migrations and reseed |
| `npm run db:studio`  | Browse the database in Prisma Studio                       |
| `npm run build`      | Production build                                           |
| `npm run start`      | Serve the production build                                 |
| `npm run lint`       | ESLint                                                     |
| `npm run typecheck`  | Generate route types, then `tsc`                           |
| `npm run format`     | Format with Prettier                                       |
| `npm run check`      | Lint, typecheck and format check                           |

## Stack

next.js (app router) with tailwind css and shadcn/ui on the frontend, hono api mounted inside the app, prisma and postgres (via neon on vercel) for storage, and vitest with mock service worker for the tests 

