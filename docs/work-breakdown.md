# Phased work breakdown

Each phase has one demonstrable milestone. Tasks are ordered by dependency within a milestone. Each implementation task owns its **red → green → refactor** cycle. The integrated verification task at the end of each milestone checks the output across component boundaries.

## Phase 01 — Foundation and account access

Outcome: A visitor can browse the facility schedule and an approved account can reach protected features.

### Milestone 01.01 — Local app with verified access rules

Exit evidence: local startup instructions, continuous integration run, and account and public availability checks. Requires a Google OAuth client for the manual sign-in check.

#### Task 01.01.01 — Set up the application and test environments

- **01.01.01.01** Set up the web and server projects and a local PostgreSQL instance. Define example environment settings for the same-origin setup.
- **01.01.01.02** Confirm dependency compatibility, apply an initial migration, and load fictional facility data.
- **01.01.01.03** Wire continuous integration to type-check, lint, apply migrations, and run the test suites. Confirm that test failures fail the run.

#### Task 01.01.02 — Implement sign-in and authorization · AC-001–004

- **01.01.02.01 Red** Write failing request tests for identity bootstrap, pending access, approval, role changes, and revocation.
- **01.01.02.02 Green** Configure Better Auth and Google, add application account states and NestJS guards, and expose searchable, audited account administration.
- **01.01.02.03 Refactor** Share authorization checks across protected routes and keep all role decisions on the server.

#### Task 01.01.03 — Implement public availability · AC-004

- **01.01.03.01 Red** Write failing checks for anonymous and pending users, redacted fields, and schedule rendering.
- **01.01.03.02 Green** Add the facility availability route, public data projection, and keyboard-operable date and facility controls.
- **01.01.03.03 Refactor** Share query definitions between route preloading and screen rendering.

#### Task 01.01.04 — Verify the access flow · AC-001–004

- **01.01.04.01** Run request and browser checks on a fresh database. Sign in with Google once in the normal local configuration.
- **01.01.04.02** Record the continuous integration run and the manual smoke result against this milestone.

## Phase 02 — Booking and approval

Outcome: A resident can request a slot and an Admin can approve it. Concurrent requests preserve schedule integrity.

### Milestone 02.01 — Booking under contention

Exit evidence: passing PostgreSQL integration checks for overlap, expiry, cap, retries, and concurrent submissions. Depends on 01.01.

#### Task 02.01.01 — Implement booking persistence and conflict rules · AC-005–007

- **02.01.01.01 Red** Add failing PostgreSQL tests for slot validation, adjacent bookings, simultaneous overlap, expired holds, the booking cap, and submission retries.
- **02.01.01.02 Green** Add booking, attempt, and schedule records. Add the exclusion constraint and facility transaction. Implement authoritative responses with available alternatives.
- **02.01.01.03 Refactor** Centralize interval, expiry, and transaction rules and preserve the expected outcomes for concurrent operations.

#### Task 02.01.02 — Implement approval, cancellation, and blocking · AC-008–009

- **02.01.02.01 Red** Write failing tests for the approval deadline, permission and ownership checks, and cancellation at and after the two-hour cutoff.
- **02.01.02.02 Green** Implement booking transitions, Admin blocks and unblock, and the resident and Admin screens. Record reasons and persist notification for the affected booker in the block transaction.
- **02.01.02.03 Refactor** Share state transition rules and invalidate affected TanStack Query data after successful writes.

#### Task 02.01.03 — Verify the booking flow · AC-005–009

- **02.01.03.01** Run the booking tests against PostgreSQL with independent connections. Run a browser walkthrough from public availability to confirmed booking.
- **02.01.03.02** Record the test run, including the observed winner and conflict from the race test.

## Phase 03 — Maintenance closures and notification

Outcome: A staff closure changes availability and cancels affected bookings, with visible feedback to residents.

### Milestone 03.01 — Booking-to-closure walkthrough

Exit evidence: successful browser walkthrough and passing tests for closure atomicity and the approval race. Depends on 02.01.

#### Task 03.01.01 — Implement closure scheduling · AC-010–011

- **03.01.01.01 Red** Write failing tests for closure permissions, overlaps, reopening, and both commit orders in the approval race. Exercise the schedule transitions before adding notification assertions.
- **03.01.01.02 Green** Implement closure creation and ending, booking cancellations, public schedule updates, and the Facility Staff screen.
- **03.01.01.03 Refactor** Reuse the facility transaction and keep closure-specific cancellation reasons visible to the affected resident.

#### Task 03.01.02 — Implement in-app notifications · AC-010, AC-012

- **03.01.02.01 Red** Write failing tests for notification visibility, retries, and rollback when a notification write fails.
- **03.01.02.02 Green** Persist notifications with the booking transition, enforce unique closure notifications, and add the resident inbox.
- **03.01.02.03 Refactor** Reuse recipient filtering and update the inbox after relevant actions.

#### Task 03.01.03 — Verify the integrated resident, Admin, and staff flow · AC-001–012

- **03.01.03.01** Run the full suite and browser walkthrough. Check that the resident sees the cancellation and a visitor sees the closure.
- **03.01.03.02** Record passing checks and any remaining defects against the same build.

## Phase 04 — GitHub portfolio handoff

Outcome: A reviewer can understand, reproduce, and verify the project from the repository.

### Milestone 04.01 — Pin-ready repository

Exit evidence: verified README, fictional seed setup, a short demo video or screenshots, and passing continuous integration. Depends on 03.01.

#### Task 04.01.01 — Prepare the repository walkthrough · AC-013

- **04.01.01.01** Draft the README with a short overview, setup and test commands, credentials setup, and links to the design and race tests.
- **04.01.01.02** Capture the public schedule, approval, closure, and resident notification using fictional data.
- **04.01.01.03** Remove real account details and machine-specific paths from examples. Describe the showcase scope and deferred roadmap.

#### Task 04.01.02 — Verify the reviewer experience · AC-013

- **04.01.02.01** Follow the README from a fresh checkout and verify migrations, seed data, demo navigation, and tests.
- **04.01.02.02** Check media and links in the repository view. Record the reviewed commit and continuous integration result.
