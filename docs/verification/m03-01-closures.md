# M03.01 verification — booking to closure

Task 03.01.03 · 27 November 2026 · AC-001–012

## Build and environment

Verified `53550f7` plus the mobile header fix in this change. Node 24.22.1,
Bun 1.3.12, PostgreSQL 18.7 and Chromium 157 on Fedora 44. The browser used
four isolated sessions: visitor, Riley Resident, Avery Admin and Sam Staff.
All identities and facilities were fictional. Google was not contacted.

Two disposable databases were created for the walkthrough, with the final run
using `court_side_verify_codex_final`. All six migrations and the facility seed
applied to an empty database. The Admin was provisioned by fixture subject;
Riley and Sam were approved through the Accounts screen, and Sam's role was
changed to Facility Staff. Automated tests used the separate `_test` database.
Development data was untouched.

[Baseline CI](https://github.com/Caff-Core/court-side/actions/runs/45985109208)
passed on `53550f7`. This verification PR also runs lint, typecheck, migrations,
tests and build in CI.

## Automated evidence

The final local run passed 120 server tests (10 files) and 29 web tests (6 files),
as well as lint, typecheck and build.

| Criteria | Evidence |
| --- | --- |
| AC-001–004 | Account access tests cover fixture bootstrap, pending access, roles, revocation and auditing; availability tests enforce the public projection |
| AC-005–009 | Booking, lifecycle and race suites cover boundaries, overlap, cap, retries, expiry, cancellation and Admin blocks |
| AC-010–011 | Closure tests cover permissions, overlapping bookings, reopening, both sequential commit orders, and concurrent approval/closure requests on separate app instances |
| AC-012 | Notification tests check recipient isolation, concurrent closure retries, and rollback of booking, schedule, closure and audit writes on notification failure |

Observed booking winners were Riley 4 and Morgan 6 across ten rounds, each with
one reservation and one conflict. The six closure races observed approval first
five times and closure first once, with no active booking left inside a closure.
Both commit orders are asserted
explicitly; the concurrent test does not require both orders to happen randomly.
A winner split alone is not proof that transactions overlapped in time: the
independent pools, simultaneous dispatch and database invariants provide the
relevant evidence.

## Integrated browser walkthrough

| Step | Expected and observed result |
| --- | --- |
| Public availability | Tomorrow's Cedar Park Basketball Court 18:00–18:30 slot is Available; sign-in prompt works |
| Account approval | Riley initially has pending access; Avery approves Riley as Resident |
| Booking request | Enter on the slot and Send request creates a pending hold |
| Booking approval | Avery approves it; Riley sees Confirmed; the visitor sees Booked without Riley's name |
| Staff role | Avery approves Sam and assigns Facility Staff through the Accounts menu |
| Closure | Sam closes 17:00–20:00 with reason “Basketball hoop safety inspection”; one booking is cancelled and notified |
| Resident booking | Riley sees Cancelled and the closure reason |
| Inbox | Keyboard Enter on the bell opens exactly one cancellation notification with the reason |
| Public closure | Visitor sees Closed; neither the reason nor Riley's name appears |
| Read state | Mark all as read clears both the inbox unread count and bell count |
| Reopening | Ending the closure restores Available; Riley's booking stays Cancelled |

All 13 script assertions passed. No unexpected console errors were observed;
signed-out `/api/me` responses are expected 401s.

## Responsive correction

The initial 375px check exposed header overflow for Admin and Staff, whose extra
navigation links exceeded one row. The header now places navigation below the
account controls and lets links wrap on narrow screens. It preserves the
installed components and their styling.

The final run checked visitor, resident, Admin and Staff at 375, 768 and 1440px:
all 12 combinations had no horizontal page overflow. Screenshots were visually
inspected. ReUI C1–C4 checks and the audit checklist passed for the changed file.
No component was installed and no animation was added. Existing loading,
empty and error states were unchanged.

This is a functional and responsive check, not a claim of complete WCAG
conformance or a measured Core Web Vitals pass. No screenshot comparison
baseline or screen-reader audit was available.

## Remaining verification and scope

- The real Google OAuth smoke test remains unrun under [#4](https://github.com/Caff-Core/court-side/issues/4).
  Fixture tests do not replace it; the configured client credentials are still required.
- Email delivery, events, live hosting and production operations are deferred in
  the [portfolio scope](../portfolio-scope.md), not implemented features of this release.
- Screenshots of this same flow accompany the repository walkthrough task.
