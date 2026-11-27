# Court Side

Community sports facility booking for one fictional community. Residents request courts, Admins confirm requests, and Facility Staff schedule maintenance closures that cancel affected bookings and notify residents in-app.

**Start here:** [five-minute walkthrough and screenshots](docs/walkthrough.md) · [architecture](docs/architecture.md) · [acceptance criteria](docs/acceptance-and-testing.md) · [verification evidence](docs/README.md)

## Run locally

Requirements: Bun **1.3.12** (pinned in `package.json`), Node.js **24**, and Docker with Compose. PostgreSQL 18 uses host port **5433**; the web app uses **5173**, the API **3000**.

From a fresh checkout:

```bash
cp .env.example .env
openssl rand -base64 32
# Put the generated value in .env as BETTER_AUTH_SECRET.
bun install --frozen-lockfile
bun run db:up
bun run --cwd apps/server generate
bun run db:seed
bun run --cwd apps/server db:seed:demo
bun run dev
```

Open [localhost:5173](http://localhost:5173). `curl http://localhost:5173/api/health` should return `{"status":"ok","database":"up"}`. The browser uses one origin: Vite proxies `/api` to NestJS. The production build serves both from NestJS.

The example environment enables fictional sign-in personas; Google credentials can stay empty for this demo. Use a fresh local database for the demo seed: it provisions the single first Admin and adds schedule examples. The [walkthrough](docs/walkthrough.md) explains the personas, tomorrow's examples, and how to create a real booking and closure through the UI. All facility times use **America/Toronto**.

If the ports are occupied, change `POSTGRES_PORT` and the port in `DATABASE_URL` together; change `WEB_PORT` and `APP_URL` together; `PORT` controls the API. Existing Docker volumes keep their database initialization settings. Use a separate database for an independent run rather than expecting changed environment values to recreate an existing database.

## Google credentials and first Admin

For real sign-in, use a separate local database from the seeded demo. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, keep a generated `BETTER_AUTH_SECRET`, and set `AUTH_IDENTITY_FIXTURE=false`. Configure the Google web OAuth client with the callback `http://localhost:5173/api/auth/callback/google` (or your actual `APP_URL` plus `/api/auth/callback/google`). The fixture is refused in production.

Sign in once, then have the database operator identify that account's verified Google subject (`account.account_id` for provider `google`). Provision that subject once:

```bash
bun run --cwd apps/server admin:provision --subject 'verified-google-subject'
```

Sign out and back in to claim the Admin role. The subject is not an email address or OAuth client ID; the provisioning record is a singleton. Never commit `.env`, client secrets, tokens, or real account exports. The real Google smoke test remains [pending in #4](https://github.com/Caff-Core/court-side/issues/4); fixture checks do not verify Google configuration.

## Verify

With PostgreSQL running and the setup above complete:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Server tests create a sibling database ending in `_test`, apply migrations, and reset its test tables. The database user needs permission to create it (the supplied Compose user has this). Do not point tests at a shared test database. [CI](https://github.com/Caff-Core/court-side/actions/workflows/ci.yml) runs lint, typecheck, migrations, tests and build with PostgreSQL.

The no-double-booking requirement **FR-03.4** is implemented with [facility transactions](apps/server/src/schedule/facility-transaction.ts) and the [database exclusion constraint](apps/server/prisma/migrations/20261127120000_booking_requests/migration.sql). The [booking race test](apps/server/test/booking-race.test.ts) dispatches competing requests through independent app instances; [closure tests](apps/server/test/closures.test.ts) check approval/closure ordering. [Notification tests](apps/server/test/notifications.test.ts) cover recipient isolation and transactional rollback. See the [integrated verification](docs/verification/m03-01-closures.md) for results and limits.

## Scope and roadmap

Implemented: public availability, account approval and roles, booking requests and holds, confirmation, cancellation, Admin blocks, maintenance closures, and an in-app cancellation inbox. Public responses omit resident identities and internal reasons.

Deferred: event management and registration, email delivery, issue reports, waitlists, reporting, weather alerts, live hosting and production operations. Seeded event entries demonstrate a schedule status; they do not imply an event-management feature. See the [portfolio scope](docs/portfolio-scope.md) and [work breakdown](docs/work-breakdown.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | React 19, Vite, Tailwind CSS v4, TanStack Router and Query |
| `apps/server` | NestJS 12 API, Prisma 7 schema, migrations, fictional seed data |
| `packages/ui` | Shared shadcn/ui and ReUI components (`@workspace/ui`) |
| `docs` | Architecture, walkthrough, scope, acceptance criteria and evidence |

## Database commands

| Command | Effect |
| --- | --- |
| `bun run db:up` / `db:down` | Start or stop PostgreSQL; stopping preserves its volume |
| `bun run db:deploy` | Apply committed migrations |
| `bun run db:seed` | Apply migrations and restore fictional facilities |
| `bun run db:migrate` | Create/apply a development migration after a schema change |
| `bun run db:reset` | **Destructive:** drop the local database, reapply migrations, reseed |

## Adding components

Use installed components first and follow [the ReUI rules](AGENTS.md). To add a component to the shared package:

```bash
bunx --bun shadcn@latest add button -c apps/web --yes
bunx --bun shadcn@latest add @reui/data-grid -c apps/web --yes
```

Import with `@workspace/ui/components/button`. See [the design and stack decisions](docs/architecture.md).
