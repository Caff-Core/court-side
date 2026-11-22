# Acceptance and testing

## How the plan and development workflow fit together

The Work Breakdown Structure (WBS) shows the order of deliverables and their dependencies. Specification-Driven Development (SDD) defines the expected behavior and acceptance criteria before implementation. Test-Driven Development (TDD) runs inside each implementation task. A milestone can contain several small test-first cycles.

For each behavior, write a focused test and confirm it fails for the missing behavior (**red**). Make the smallest working change and run the test again (**green**). Improve the implementation with the relevant tests passing (**refactor**). Repeat within the task. Setup and documentation subtasks use executable checks or review. Milestone verification runs the completed pieces together.

Example for FR-03.4 and AC-006: send two overlapping booking requests using separate PostgreSQL connections. Confirm the new test fails before overlap protection exists. Add the facility transaction and schedule constraint, then check that one request succeeds and one receives a conflict. Refactor the schedule logic and rerun the test.

## Acceptance matrix

All listed tests have status **Not run**. No product evidence has been recorded. The portfolio scope selects the relevant portions of the source requirements. For example, FR-04.6 covers in-app notification here and retains email in the broader baseline.

| Criterion | Source | Expected behavior | Planned verification | Implementing task |
| --- | --- | --- | --- | --- |
| AC-001 | FR-01.1–01.4, FR-02.2, FR-02.4 | The configured Google identity becomes first Admin once. Other first sign-ins create pending accounts. Only an Admin can approve an account as Resident or change its role. | TEST-001 · Request tests with identity fixtures and one real Google smoke test | 01.01.02 |
| AC-002 | FR-01.5, FR-02.3 | After successful revocation, the user's existing session fails on its next protected request and a fresh sign-in cannot regain protected access. | TEST-002 · Session and request integration | 01.01.02 |
| AC-003 | FR-02.1, FR-02.5, NFR-08 | Only Admins can search accounts and see status and role. Approval, revocation, and role changes record the actor, action, and timestamp. | TEST-003 · Request and database integration | 01.01.02 |
| AC-004 | FR-03.8, NFR-01 | Anonymous and pending users can browse dates and facilities, including with a keyboard. They see schedule status without booker details or private reasons. Pending users can see their own approval status and cannot book. | TEST-004 · Request access and keyboard browser checks | 01.01.02, 01.01.03 |
| AC-005 | FR-03.1–03.3 | Active, permitted accounts can book aligned 30-minute intervals during opening hours and within 14 days. Invalid ranges fail. Two active future bookings for one facility are allowed. A third fails, even if submitted concurrently with the second for a different slot. | TEST-005 · Boundary tests and PostgreSQL request integration | 02.01.01 |
| AC-006 | FR-03.4, FR-03.8 | Two distinct overlapping requests for one facility yield one reservation or hold and one conflict with available alternatives when present. Adjacent intervals remain bookable. | TEST-006 · PostgreSQL race using independent connections with synchronized starts | 02.01.01 |
| AC-007 | FR-03.3, FR-03.5 | An approval-only request holds a slot until the earlier of 24 hours after submission or slot start. At expiry it stops blocking availability and counting toward the cap, even before background cleanup. Retrying an identical submission returns one outcome and creates at most one booking. | TEST-007 · Controlled-clock and PostgreSQL retry checks | 02.01.01 |
| AC-008 | FR-03.5, FR-03.6 | Auto-confirm facilities confirm immediately. Only Admin can approve a pending request before its deadline. The requester may withdraw a pending hold or cancel a confirmed booking. Confirmed cancellation at exactly two hours before start is timely. A later pre-start user cancellation releases the time and records a no-show. Other users cannot cancel it. | TEST-008 · Lifecycle and request integration | 02.01.02 |
| AC-009 | FR-03.7, NFR-08 | Admin can block a future hold or booking with a reason. The time stays unavailable until the block ends or Admin removes it. The affected user receives an in-app notification and the change is audited. | TEST-009 · Request and database integration | 02.01.02 |
| AC-010 | FR-03.8–03.9, FR-04.6, NFR-08 | Staff or Admin can create or end a closure with a reason. Creating one cancels overlapping pending or confirmed bookings that have yet to end, marks the period unavailable, and produces one in-app notification per affected booking. Ending it releases the time still available under other schedule restrictions. These actions are audited. | TEST-010 · Request and database integration plus browser walkthrough | 03.01.01, 03.01.02 |
| AC-011 | FR-03.5, FR-03.9, FR-04.6 | An approval racing with a closure leaves no active booking inside it. If closure commits first, approval fails. If approval commits first, closure cancels it. | TEST-011 · PostgreSQL integration exercises both commit orders | 03.01.01 |
| AC-012 | FR-04.6, FR-05.4 | Only the recipient can view their notifications. Retrying a closure creates no duplicate notifications. If a notification write fails, the closure, cancellation, and schedule changes roll back together. | TEST-012 · Request access, retry, and failure injection | 03.01.02 |
| AC-013 | Portfolio outcome, NFR-06 | A reviewer can follow the README from a fresh checkout, load the fictional data, view the media, and run the checks. The repository links from FR-03.4 to the concurrency test. | TEST-013 · Fresh-checkout review and continuous integration run | 01.01.01, 04.01.01, 04.01.02 |

## Milestone evidence

Record the commit, environment, expected result, actual result, and a test run or capture link at each integrated verification task. Use a controlled clock for deadline boundaries. Exercise database conflicts and rollback on real PostgreSQL. Test keyboard navigation on the main flow. Keep automated sign-in tests independent of external Google availability and record the manual sign-in result separately.
