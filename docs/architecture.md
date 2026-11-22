# Architecture

## Stack

| Layer | Choice and responsibility |
| --- | --- |
| Web | React 19, TypeScript, Vite, Tailwind CSS v4, and shadcn/ui. Import selected ReUI components from its registry. |
| Client data | TanStack Router for navigation and shareable filters. TanStack Query for server data and mutations. TanStack Table for admin grids. Native fetch for application requests. |
| Client state | Start with component state. Add Zustand when a workflow needs shared client state. Revisit TanStack DB when client-side reactive joins are needed. Axios is deferred. |
| Server | NestJS with Express. Serve the web app and application programming interface (API) on one origin, including sign-in routes. |
| Identity | Better Auth with Google OpenID Connect (OIDC), database-backed sessions, and the Prisma adapter. Disable session cookie caching. |
| Persistence | Prisma 7 and PostgreSQL. Commit Prisma migrations and custom Structured Query Language (SQL) for the schedule constraint. |
| Verification | Proposed defaults: Vitest for web unit tests, Jest and Supertest for NestJS tests, Playwright for browser checks, and PostgreSQL for database integration tests. Confirm compatible versions during setup. |

## Identity and access

Better Auth validates Google identity and owns sessions. The application owns account status and roles. Associate the account with the verified issuer and subject. The deployment operator provisions the first Admin by that identity through a one-time command. Other first sign-ins create pending accounts without a role. Admin approval grants Resident access and an Admin can later change the role.

Check the current account status and role on every protected request. Revocation disables the account and invalidates its sessions. Public routes return a filtered schedule and a pending user can see their own review status. Browser route guards guide navigation. The server guards every protected read and write.

## Database design

| Record | Purpose and links |
| --- | --- |
| User and Better Auth records | Identity, account status, role, and active sessions |
| Facility | Name, operating hours, community time zone, and whether approval is required |
| Booking | Facility, requester, start/end, state, submission time, expiry, and change reason |
| BookingAttempt | Unique submission identifier tied to the requester, outcome and optional Booking link. Replaying an identical submission returns the recorded outcome |
| MaintenanceClosure | Facility, time range, creator, reason, status, and unique creation request identifier |
| ScheduleEntry | Facility, start/end, entry kind, and originating record. Current pending holds, confirmed reservations, blocks, and closures occupy this table. Published events can use it when added |
| Notification | Recipient, booking, type, created time, and read time. A unique booking-and-closure key protects cancellation notifications from duplication |
| AuditLog | Actor, action, entity, and timestamp for privileged account and schedule changes |

Store instants as timezone-aware timestamps. Display them in the configured community time zone. Use start-inclusive, end-exclusive ranges so adjacent reservations can share an endpoint. Seed operating hours and validate the full interval against operating hours, slot alignment, and the 14-day booking window.

## Schedule writes

1. Lock the facility row in each schedule-writing transaction. Read the current time after acquiring the lock. Release expired holds before checking occupancy or the two-booking cap. Availability reads also ignore expired holds when cleanup has yet to run.
2. Apply a PostgreSQL exclusion constraint to overlapping hold and reservation rows for the same facility. Add it with a custom Prisma migration. The same transaction checks all blocking schedule entries, including Admin blocks and closures. Blocks and closures can overlap each other, and the facility lock serializes changes to them.
3. Keep one bookable reservation entry per pending or confirmed booking. Approval changes the existing hold to confirmed. Expiry or user cancellation removes it from the active schedule while preserving booking history. A block replaces a hold or confirmed booking with a block that lasts until its end or Admin removal.
4. When Staff or Admin adds a closure, cancel overlapping pending and confirmed bookings whose end times are still in the future. Write the closure, schedule changes, booking transitions, and one in-app cancellation notification per affected booking in the same transaction. An approval that arrives afterward fails. If approval commits first, the closure cancels the confirmed booking. Ending a closure releases only that closure's restriction. Retrying the same closure request returns the recorded closure without repeating side effects.
5. Return a conflict and available alternatives when a booking loses a race. An identical retried submission receives its original outcome. Reject reuse of a submission identifier with changed booking details.

**Booking transitions**

| From | To | Trigger |
| --- | --- | --- |
| New | Pending or confirmed | Facility approval setting |
| Pending | Confirmed, expired, cancelled, blocked | Admin approval, deadline, withdrawal or closure, Admin block |
| Confirmed | Cancelled, no-show, blocked | Timely user cancellation or closure, late user cancellation, Admin block |

The pending deadline is the earlier of submission plus 24 hours and slot start. Approval at the deadline fails. A user cancellation at exactly two hours before start is timely. Admin and closure actions have their own reasons so they do not count as user no-shows.
