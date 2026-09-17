# Dashboard

A customizable dashboard that gathers information from services you already use — weather, GitHub,
Spotify, RSS feeds and the stock market — into widgets that refresh on their own schedule.

> Work in progress. This README is a stub; the full documentation (features, screenshots, architecture
> diagrams) is tracked in [issue #37](../../issues/37). The reasoning behind every technical choice
> lives in [PLAN.md](PLAN.md).

## Requirements

- Node.js 22 or later (see `.nvmrc`)
- Docker and Docker Compose

## Getting started

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

A one-command setup (environment file, database and mail containers, migrations, seed data) arrives with
[issue #3](../../issues/3), and the Docker Compose stack serving port 8080 with
[issue #6](../../issues/6).

## Scripts

| Script              | What it does                     |
| ------------------- | -------------------------------- |
| `npm run dev`       | Development server on port 3000  |
| `npm run build`     | Production build                 |
| `npm run start`     | Serve the production build       |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | Generate route types, then `tsc` |
| `npm run format`    | Format with Prettier             |
| `npm run check`     | Lint, typecheck and format check |

## Stack

Next.js 16 (App Router) with Tailwind CSS v4 and shadcn/ui. The API layer, database, authentication and
the widget services are being added milestone by milestone — see [PLAN.md](PLAN.md) for the full
architecture and the reasoning behind each decision.
