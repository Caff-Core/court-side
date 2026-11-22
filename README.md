# Court Side

Community sports facility booking for a single example community. Residents request courts, Admins confirm requests, and Facility Staff schedule maintenance closures that cancel affected bookings.

Planning documents live in [`docs/`](docs/README.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | React 19, Vite, Tailwind CSS v4, TanStack Router and Query |
| `apps/server` | NestJS 12 API, Prisma 7 schema, migrations, and fictional seed data |
| `packages/ui` | Shared shadcn/ui and ReUI components (`@workspace/ui`) |
| `docs` | Scope, architecture, work breakdown, and acceptance criteria |

The browser talks to one origin. In development Vite serves the web app on port 5173 and proxies `/api` to NestJS on port 3000. In production NestJS serves the built web app and the API together.

## Requirements

- [Bun](https://bun.sh) 1.3 or later
- Node.js 24
- Docker with Compose, for the local PostgreSQL 18 database

## Getting started

```bash
cp .env.example .env
bun install
bun run db:up      # start PostgreSQL on localhost:5433
bun run db:seed    # apply migrations and load the fictional facilities
bun run dev        # web on http://localhost:5173, API under /api
```

Check the API with `curl http://localhost:5173/api/health`.

## Database

| Command | Effect |
| --- | --- |
| `bun run db:up` / `db:down` | Start or stop the PostgreSQL container |
| `bun run db:migrate` | Create and apply a migration after editing `apps/server/prisma/schema.prisma` |
| `bun run db:deploy` | Apply committed migrations |
| `bun run db:seed` | Apply migrations, then load or restore the fictional seed data |
| `bun run db:reset` | Drop the local database, reapply migrations, and reseed |

## Checks

The server tests run against PostgreSQL, so start the database and seed it first.

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Continuous integration runs the same steps against a PostgreSQL service container.

## Adding components

Run the shadcn CLI against the web app. Components land in `packages/ui/src/components`.

```bash
bunx --bun shadcn@latest add button -c apps/web --yes
bunx --bun shadcn@latest add @reui/data-grid -c apps/web --yes
```

Import them from the shared package:

```tsx
import { Button } from "@workspace/ui/components/button"
```
