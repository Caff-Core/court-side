# Court Side

Community sports facility booking for a single example community. Residents request courts, Admins confirm requests, and Facility Staff schedule maintenance closures that cancel affected bookings.

Planning documents live in [`docs/`](docs/README.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | React 19, Vite, Tailwind CSS v4, TanStack Router and Query |
| `packages/ui` | Shared shadcn/ui and ReUI components (`@workspace/ui`) |
| `docs` | Scope, architecture, work breakdown, and acceptance criteria |

The NestJS server, Prisma schema, and local PostgreSQL setup arrive with milestone 01.01.

## Requirements

- [Bun](https://bun.sh) 1.3 or later
- Node.js 20.19 or later

## Getting started

```bash
bun install
bun run dev
```

## Checks

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

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
