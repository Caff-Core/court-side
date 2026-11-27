# M02.01 verification — booking under contention

Task 02.01.03 · 27 November 2026 · AC-005 to AC-009

## Environment

| Item | Value |
| --- | --- |
| Commit under test | `b706a02` on `main` (after #18 and #19), plus the race test added in this change |
| OS | Fedora Linux 44 |
| Runtime | Node.js 24.22.1, Bun 1.3.12 |
| Database | PostgreSQL 18.7 (`postgres:18-alpine`, Docker Compose, port 5433) |
| Browser | Chromium 157, headless, driven by Playwright |
| Fresh databases | `court_side_verify` and `court_side_verify_test`, created empty, migrated and seeded for this run, then dropped |
| Clock | Request tests use a controlled clock fixed at Friday 27 November 2026, 14:10 in Toronto |

## Continuous integration

| Commit | Run | Result |
| --- | --- | --- |
| `b706a02` booking approval, cancellation and blocks (#19) | [45981615562](https://github.com/Caff-Core/court-side/actions/runs/45981615562) | Pass |
| `871d659` booking requests with conflict and cap rules (#18) | [45978689958](https://github.com/Caff-Core/court-side/actions/runs/45978689958) | Pass |

## Automated checks on the fresh database

`bun run test` with `DATABASE_URL` pointing at `court_side_verify`: server 8 files (98 tests) and web 4 files (21 tests) pass.

| AC | Suite | Covers |
| --- | --- | --- |
| AC-005 | `bookings.test.ts` | Roles allowed, visitors 401, pending 403, invalid ranges 400, two upcoming bookings allowed, a third refused, including when it races the second |
| AC-006 | `bookings.test.ts`, `booking-race.test.ts` | Adjacent intervals, conflicts with alternatives, events, blocks and closures refuse bookings, the exclusion constraint, and races across independent connections |
| AC-007 | `bookings.test.ts` | Hold deadline at the earlier of 24 hours and the start, expiry before cleanup for availability and the cap, retries and replays with one Idempotency-Key |
| AC-008 | `booking-lifecycle.test.ts` | Admin-only approval, approval at the deadline fails, withdrawal, cancellation at exactly two hours is timely, later is a no-show, ownership |
| AC-009 | `booking-lifecycle.test.ts` | Block with a reason until removed, booker notification, audit entry, Admin only |

## Race test across independent connections

`test/booking-race.test.ts` starts two app instances. Each has its own PostgreSQL connection pool. Riley (instance 1) asks for 10:00–11:00 and Morgan (instance 2) for 10:30–11:30 on Saturday at Maple Grove Tennis Court 1. Both requests start in the same tick, and the order in code alternates each round.

| Round | Winner (201) | Conflict (409 `slot_unavailable`) | Alternatives offered |
| --- | --- | --- | --- |
| 1 | Riley, instance 1 | Morgan, instance 2 | 3 |
| 2 | Morgan, instance 2 | Riley, instance 1 | 3 |
| 3 | Riley, instance 1 | Morgan, instance 2 | 3 |
| 4 | Riley, instance 1 | Morgan, instance 2 | 3 |
| 5 | Riley, instance 1 | Morgan, instance 2 | 3 |
| 6 | Morgan, instance 2 | Riley, instance 1 | 3 |
| 7 | Riley, instance 1 | Morgan, instance 2 | 3 |
| 8 | Riley, instance 1 | Morgan, instance 2 | 3 |
| 9 | Riley, instance 1 | Morgan, instance 2 | 3 |
| 10 | Morgan, instance 2 | Riley, instance 1 | 3 |

Winners: Riley 7, Morgan 3. Both instances won rounds, so the requests did contend. Every round produced exactly one reservation and one conflict with alternatives.

Cap race: in 5 of 5 rounds, with one booking already held, two requests for different slots from the same account on separate instances gave one 201 and one 409 `booking_limit`.

## Browser walkthrough: public availability to confirmed booking

| Check | Expected | Actual | Result |
| --- | --- | --- | --- |
| Visitor | Sees an open slot and a way to sign in | Cedar Park Basketball Court, Saturday 28 November, 6:00–6:30 PM shows Available; "Sign in to request a court" opens sign-in | Pass |
| Account approval | New sign-in is pending until an Admin approves it | Admin approved Riley as Resident from the Accounts page | Pass |
| Request | An approval-only request holds the slot | Riley requested the slot with the keyboard (Enter on the slot, Enter on Send request); the slot shows Pending | Pass |
| Approval | Admin approves before the deadline | Approved from the Requests page | Pass |
| Confirmed | Booker sees Confirmed; the public sees Booked without the name | Your bookings shows Confirmed; the public slot shows Booked and the page has no booker name | Pass |

No console errors apart from the expected 401 from `/api/me` while signed out.
