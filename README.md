# Dashboard

A customizable dashboard that gathers information from services you already use, weather, GitHub, Spotify, RSS feeds and the stock market, into widgets that refresh on their own schedule.

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

The Docker Compose stack serving port 8080 arrives with [issue #6](../../issues/6).

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

Next.js 16 (App Router) with Tailwind CSS v4 and shadcn/ui.
