# M04.01 verification — fresh-checkout reviewer experience

Task 04.01.02 · 27 November 2026 · AC-013 / TEST-013

## Reviewed revision and environment

Reviewed commit [`16ef039`](https://github.com/Caff-Core/court-side/commit/16ef039cc700c847c8483800007a9dddbcb0e4fe), the walkthrough change subsequently squash-merged in [PR #24](https://github.com/Caff-Core/court-side/pull/24) as `ce6d9a4`. Its [CI run](https://github.com/Caff-Core/court-side/actions/runs/45994037334) passed lint, typecheck, migrations, tests and build. The [merged-main CI run](https://github.com/Caff-Core/court-side/actions/runs/45994288736) also passed on `ce6d9a4`.

The review used a new Git clone with no existing dependencies or generated client, a separate Docker Compose project and new PostgreSQL volume, and a generated local authentication secret. Environment: Bun 1.3.12, Node.js 24.22.1, PostgreSQL 18 and Chromium 157 on Fedora 44. Google credentials were empty and the local identity fixture was enabled.

To avoid the existing development services, the documented port overrides were used: PostgreSQL 5434, web 5182 and API 3102. `APP_URL` matched the web port and `DATABASE_URL` matched the database port. No existing development database was reset or reused. Tests created their separate `_test` database in the isolated container.

## Setup and checks

The README commands were followed in order: copy the example environment, generate a secret, install with the frozen lockfile, start PostgreSQL, generate the Prisma client, seed facilities, seed the demo, and start development services.

| Check | Expected | Observed |
| --- | --- | --- |
| Frozen install | Lockfile installs without updates | Passed; 1,632 packages installed |
| Database startup | New PostgreSQL service is healthy | Passed with a new project and volume |
| Client generation | Prisma client available before seeding | Passed |
| Migrations and facilities | All migrations apply to an empty database | Six migrations applied; four facilities seeded |
| Demo seed | Fictional personas and tomorrow's schedule examples | Avery, Sam, Riley and Jordan created; entries placed on 28 November |
| Health endpoint | API and database are reachable | `{"status":"ok","database":"up"}` |
| Lint and typecheck | No failures | Passed |
| Tests | Server and browser-unit suites pass | 120 server tests across 10 files; 29 web tests across 6 files |
| Build | Server and web compile | Passed |

The booking race run observed four Riley wins and six Morgan wins, with one successful reservation and one conflict per round. See the [race tests](../../apps/server/test/booking-race.test.ts) for the assertions and the [integrated verification](m03-01-closures.md) for the limits of interpreting winner counts.

## Seeded browser walkthrough

Separate browser sessions followed the [walkthrough](../walkthrough.md) using Riley, Avery, Sam and a signed-out visitor. All 11 assertions passed:

1. Visitor sees an available basketball slot and can follow the sign-in prompt.
2. Riley requests tomorrow's 18:00–18:30 slot; it becomes Pending.
3. Avery approves the request.
4. The visitor sees Booked without the resident's name.
5. Sam closes 17:00–20:00; one booking is cancelled and notified.
6. Riley sees Cancelled with the maintenance reason.
7. The inbox contains exactly one cancellation notification with that reason.
8. The visitor sees Closed without private names or reasons.
9. Mark all as read clears the unread state.
10. Ending the closure restores Available.
11. Reopening does not reinstate Riley's cancelled booking.

No unexpected browser console errors were observed. All four roles at 375, 768 and 1440px had no horizontal page overflow. This is functional and responsive verification, not complete accessibility certification.

## Repository presentation

The actual GitHub pages for README and the walkthrough were loaded at the reviewed commit. Both rendered successfully. All four embedded PNGs decoded at their original dimensions: approval 1280×950, public schedule 1280×1057, closure 1280×950, and resident notification 1280×950. The README's booking race link resolved to `apps/server/test/booking-race.test.ts` at that revision. Local relative links in the README, documentation index and walkthrough all resolved to tracked files.

The [committed screenshots](../walkthrough.md) contain fictional data and show the same application flow. Examples use repository-relative paths and local example credentials; they contain no machine-specific paths or real account details.

## Remaining boundary

AC-013's fresh-checkout setup, fictional demo, media and automated-check requirements passed. Real Google OAuth verification remains separately pending in [#4](https://github.com/Caff-Core/court-side/issues/4), requiring configured Google credentials. This result does not claim that check passed. Email delivery, event management and hosting remain [deferred scope](../portfolio-scope.md).
