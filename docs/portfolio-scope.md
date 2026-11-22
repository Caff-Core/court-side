# Portfolio scope

## Outcome

A reviewer should be able to follow the booking-to-closure demo, run the app locally with fictional data, and verify the main scheduling and permission rules in automated tests.

## Portfolio release

- Public facility availability with time ranges and statuses. Keep account details and internal reasons private.
- Google sign-in, pending accounts, Admin approval, role assignment, access revocation, and first-Admin provisioning.
- Future bookings in consecutive 30-minute slots within 14 days. Enforce two active future bookings per user per facility.
- Auto-confirm at facilities that allow it. At approval-only facilities, hold the slot until Admin approval, blockage, withdrawal, closure, or expiry.
- Own-booking cancellation and Admin blocks with a reason. Record user cancellations less than two hours before start as no-shows and release the time.
- Time-bounded maintenance closures by Facility Staff or Admin. Cancel affected bookings and create in-app notifications. Show reopened time subject to other reservations or blocks.
- Responsive booking and admin screens, fictional seed data, automated checks, a reproducible local setup, and a short video or screenshots.

## Roadmap

Defer public events and registration, issue reporting and photo uploads, email delivery, waitlists, exports and reporting dashboards, and weather alerts. Live deployment, uptime and support commitments, and production operations are outside the portfolio release. Preserve the event conflict and cancellation policies in the full specification for a future release. Native apps, payment processing, multiple communities per deployment, text-message notifications, and access hardware remain outside the original v1 scope.

The original 90% booking completion goal measures unique submissions that reach confirmation. Rejections, pre-confirmation withdrawals, and expirations count in the denominator. Later cancellation does not undo a confirmation. The full specification defines the reporting period. Product analytics and operational targets can be revisited if the project goes live.

## Decisions for the review build

| Decision | Effect |
| --- | --- |
| One example community and fictional facilities | A deterministic walkthrough with both auto-confirm and approval-only booking |
| No hosted demo required | Screenshots or a short video carry the reviewer through all three roles |
| Google sign-in as the normal path | Run one real Google smoke test with local credentials. Automated tests use a local identity fixture. Any shortcut stays confined to a dedicated test or demo configuration |
| Booking and closure as the showcase | The README links to the schedule design and the PostgreSQL race tests |
| Local-first tooling | Proposed defaults are Docker Compose for PostgreSQL and GitHub Actions for continuous integration. Hosting and the final repository name remain open |
