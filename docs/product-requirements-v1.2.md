# Community Sports Facility Management — Requirements Specification

**Version:** 1.2 | **Date:** 2026-11-22 | **Status:** Draft for review

---

## 1. Introduction

### 1.1 Problem Statement
Many communities share sports facilities (soccer fields, basketball courts, swimming pools, gyms) that require scheduling, maintenance, and fair access management. Local governments and homeowner associations struggle to coordinate reservations, track usage, and handle maintenance efficiently.

### 1.2 Purpose
Provide a publicly available, web-based solution for managing community sports facilities: booking slots, reporting maintenance issues, organizing events, and receiving notifications.

### 1.3 Scope

**In scope:**
- Web application (responsive, desktop + mobile browser)
- Facility booking and availability tracking
- Membership and user management
- Maintenance issue reporting and tracking
- Event organization and notifications
- Reporting with CSV/PDF export
- Bonus: weather notifications for outdoor facilities

**Out of scope (v1):**
- Native mobile apps
- Payment processing / fee collection
- Multi-community tenancy (single community per deployment)
- SMS notifications
- Facility access control hardware integration

---

## 2. Stakeholders & Personas

| Role | Description | Primary Needs |
|------|-------------|---------------|
| **Resident** | Community member who books facilities and reports issues | Easy booking, visibility of availability, notifications |
| **Facility Staff** | Maintains facilities and resolves reported issues | Issue queue, status updates, closure management |
| **Admin** | Manages users, bookings, events, and reporting | User management, approval workflows, dashboards |
| **Community Association / Local Government** | Owner/operator of the facilities | Usage insights, maintenance oversight, fair access |

---

## 3. Roles & Permissions Matrix

A user has exactly **one primary role**. Admins may hold Admin plus implicit access to Resident functions (marked ✓*).

| Capability | Resident | Facility Staff | Admin |
|---|---|---|---|
| View facility availability | ✓ | ✓ | ✓ |
| Create/cancel own booking | ✓ | ✓ | ✓* |
| Approve/block bookings | – | – | ✓ |
| Report maintenance issue | ✓ | ✓ | ✓ |
| Update maintenance status | – | ✓ | ✓ |
| Close maintenance issue | – | ✓ | ✓ |
| Create/end maintenance closures | – | ✓ | ✓ |
| Create/manage events | – | – | ✓ |
| Receive notifications | ✓ | ✓ | ✓ |
| Manage users (onboard, revoke, assign roles) | – | – | ✓ |
| View/export reports | – | ✓ (maintenance only) | ✓ (all) |
| Configure facilities | – | – | ✓ |

**Role assignment:** After setup, only an Admin can assign roles. Self-registration creates a pending account without a role. Approval activates the account as a Resident. An Admin may then change the role.

**First Admin:** During deployment, the operator provisions the first Admin's exact Google OpenID Connect issuer and subject through a one-time setup command. That Google account becomes active as Admin on its first verified sign-in. Setup cannot grant Admin again once the first Admin is provisioned.

**Public and pending access:** Visitors and pending users can view published events and facility availability. Availability shows time, facility, and slot status without booker details or internal closure reasons. A signed-in pending user can also see their approval status and sign out. Booking, issue reporting, and other role-based actions require an active account and the relevant permission.

---

## 4. Objectives & Delivery Constraints

- **Methodology:** Agile (iterative sprints, backlog, retrospectives)
- **Engineering practices:** CI/CD pipeline, test-driven development (TDD)
- **Definition of Done (per feature):** code reviewed, unit + integration tests passing, deployed via CI/CD to staging, acceptance criteria verified.
- **"Publicly available":** deployed to a public URL with TLS, target 99.5% monthly uptime, supported on latest two versions of Chrome, Firefox, Safari, Edge.

---

## 5. Functional Requirements

Requirements are numbered for traceability. Priority uses MoSCoW (M/S/C/W).

### 5.1 User Verification & Authentication

| ID | Requirement | Priority |
|---|---|---|
| FR-01.1 | Authentication via a third-party identity provider (Google OIDC) | M |
| FR-01.2 | On first login, create a Pending account without a role, except for the pre-provisioned first Admin | M |
| FR-01.3 | System supports exactly three roles: Resident, Facility Staff, Admin | M |
| FR-01.4 | Admin can assign/change a user's role | M |
| FR-01.5 | Revoked users cannot authenticate into the application | M |

> **Note:** Google does not natively return custom roles. Role mapping is performed application-side after IdP authentication (lookup by verified email / subject ID).

### 5.2 User Management

| ID | Requirement | Priority |
|---|---|---|
| FR-02.1 | Admin can view a searchable list of users with role and status | M |
| FR-02.2 | Admin can onboard members (approve pending accounts) | M |
| FR-02.3 | Admin can revoke access (account disabled, sessions invalidated) | M |
| FR-02.4 | Admin can assign roles per the permissions matrix | M |
| FR-02.5 | All user-management actions are audit-logged (actor, action, timestamp) | S |

### 5.3 Booking System

| ID | Requirement | Priority |
|---|---|---|
| FR-03.1 | An active Resident, Facility Staff member, or Admin can request a booking for a facility and time slot | M |
| FR-03.2 | Bookings use one or more consecutive 30-minute slots. Only future slots within 14 days are bookable | M |
| FR-03.3 | Max 2 active (future) bookings per user per facility at any time | M |
| FR-03.4 | Reject a booking request that overlaps a pending hold, confirmed booking, published event, Admin block, or maintenance closure for the same facility. Adjacent time ranges may share an endpoint | M |
| FR-03.5 | Bookings are auto-confirmed unless the facility requires approval. A pending request holds its slot until an Admin approves or blocks it, the requester cancels it, a closure supersedes it, or it expires | M |
| FR-03.6 | The requester can withdraw a pending booking before its deadline. Confirmed bookings can be cancelled up to 2 hours before start. Later user cancellations are recorded as no-shows | S |
| FR-03.7 | An Admin can block a pending or confirmed future booking with a mandatory reason. The time remains unavailable until the block ends or an Admin removes it. The requester receives an in-app notification | M |
| FR-03.8 | Public availability shows open slots, pending holds, confirmed bookings, events, Admin blocks, and maintenance closures without requester details | M |
| FR-03.9 | Maintenance closures are unavailable for new bookings, approvals, and event scheduling | M |
| FR-03.10 | Waitlist for fully booked slots | C |

A pending request expires at the earlier of 24 hours after submission and the slot start. At the deadline it immediately stops holding time and counting toward the active-booking limit. Approval must complete before the deadline. When two requests for the same period arrive together, the first request that successfully commits holds or reserves the time. An overlapping request receives a conflict message and available alternatives. Booking creation, approval, and schedule changes must enforce these rules even when they run concurrently.

**Acceptance example (FR-03.4):**
*Given* a confirmed booking for Court 1, 10:00–11:00, *when* a second user requests Court 1, 10:30–11:30, *then* the request is rejected with a conflict message and the alternative slots are shown.

**Acceptance example (FR-03.5):** Given a pending request submitted at 09:00 for a 12:00 slot the same day, when the Admin attempts approval at 12:00, then the request is expired and the approval fails. Before 12:00, any overlapping request must be rejected while the hold is active.

### 5.4 Maintenance Reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-04.1 | Any active user can report an issue: facility, category (e.g., damage, cleanliness, equipment, safety), severity (Low/Medium/High), description, optional photo | M |
| FR-04.2 | Issue lifecycle: Open → In Progress → Resolved → Closed | M |
| FR-04.3 | Facility Staff can update status and add feedback visible to the reporter | M |
| FR-04.4 | Facility Staff can close an issue with a resolution note | M |
| FR-04.5 | Reporter receives notification on status change | S |
| FR-04.6 | A Facility Staff member or Admin can create or end a maintenance closure with a facility, time range, and reason. Creating a closure cancels overlapping pending or confirmed bookings and published events whose end times are still in the future. Notify affected bookers in-app and by email, and notify event recipients under FR-05.3 | M |

A closure takes precedence as soon as it is saved. Ending it releases the closed time subject to any other reservations or blocks. Cancelled bookings and events require fresh scheduling.

**Acceptance example (FR-04.6):** Given an upcoming confirmed booking and event at different times, when a closure covering both is saved, then both are cancelled, new requests for the closed period are rejected, and the booking owner and event recipients receive one cancellation notification per applicable channel.

### 5.5 Events & Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-05.1 | An Admin can create an event with a title, facility, start and end times, optional capacity, and description. A published event reserves its time and cannot overlap a pending hold, confirmed booking, Admin block, closure, or another event | M |
| FR-05.2 | Published events appear in the public event list and trigger announcements to all active users by default. Apply any opt-outs under FR-05.5 and store the intended recipient list before delivery | M |
| FR-05.3 | An Admin can cancel an event. Mark it cancelled in the public list and release its reservation. Send an in-app and email cancellation update to currently active users on the original announcement's recipient list. Cancellation updates are critical and are delivered regardless of later preference changes | M |
| FR-05.4 | Notifications are delivered in-app. Event announcements, event cancellations, and maintenance closure impacts also use email | M |
| FR-05.5 | Users can opt out of non-critical notifications | S |
| FR-05.6 | Event registration when capacity is set | C |

### 5.6 Reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-06.1 | Report: Usage trends by facility (bookings over time, filterable by date range and facility) | M |
| FR-06.2 | Report: Maintenance reports — open vs. closed (counts, aging, by facility/category) | M |
| FR-06.3 | Report: Custom view — user-selectable metrics and filters, saved per Admin | M |
| FR-06.4 | All reports exportable as CSV and PDF | M |
| FR-06.5 | Facility Staff can access the maintenance report only; Admins access all reports | M |

### 5.7 Bonus: Weather Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-07.1 | For outdoor facilities, system checks forecast via a weather API and warns users of adverse conditions for upcoming bookings | C |
| FR-07.2 | Admin can configure which facilities are "outdoor" and the adverse-condition thresholds | C |

---

## 6. Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-01 | Responsive UI; WCAG 2.1 AA accessibility target | S |
| NFR-02 | Page load < 3s on standard broadband; API p95 < 500ms | S |
| NFR-03 | Support 1,000 registered users / 100 concurrent users without degradation | S |
| NFR-04 | All traffic over TLS; OWASP Top 10 mitigations; secrets managed, not hard-coded | M |
| NFR-05 | Personal data handling documented (privacy notice, retention policy) | M |
| NFR-06 | Automated CI/CD: lint, unit, integration, e2e tests, staging deploy on merge | M |
| NFR-07 | TDD: new features merged with tests; coverage target ≥ 80% on core logic | M |
| NFR-08 | Audit logging for admin actions and booking state changes | S |
| NFR-09 | Daily backups with documented restore procedure | S |
| NFR-10 | Uptime target 99.5% monthly; basic monitoring/alerting | S |

---

## 7. Data Model (High Level)

`User` (id, IdP issuer, IdP subject, email, name, role, status, created_at) · `Facility` (id, name, type, indoor/outdoor, requires_approval, status) · `TimeSlot` / `Booking` (id, facility_id, user_id, start, end, status: pending/confirmed/blocked/cancelled/no_show/expired, submitted_at, approval_deadline, reason) · `BookingAttempt` (submission_id, submitted_at, outcome, booking_id if created) · `MaintenanceClosure` (id, facility_id, start, end, reason, created_by, status) · `MaintenanceIssue` (id, facility_id, reporter_id, category, severity, status, description, photo, resolution_note, timestamps) · `Event` (id, title, facility_id, start, end, capacity, description, status) · `Notification` (id, user_id, type, event_id where applicable, channel, delivery_status, payload, read_at) · `AuditLog` (id, actor_id, action, entity, timestamp).

---

## 8. Success Metrics

- Booking completion rate ≥ 90% of submitted booking attempts. An attempt starts with the first submission of a booking request and counts once even if the same submission is retried. The denominator includes requests rejected for conflicts or limits and requests that are withdrawn or expire before confirmation. The numerator counts attempts that reach Confirmed, even if later cancelled. Report by submission month in the community's time zone and finalise the result 24 hours after month-end so pending requests can resolve
- Maintenance median time-to-resolution < 5 days
- ≥ 60% of active residents hold at least one booking per month
- Notification delivery success ≥ 98%

---

## 9. Assumptions & Constraints

- Single community per deployment; facilities configured by Admin at setup.
- Google Workspace groups are **not** used for role mapping (application-side mapping instead); personal Gmail accounts supported.
- Team size, budget, and timeline to be confirmed by stakeholders.
- Hosting platform chosen to satisfy NFR-04/06/10.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| IdP outage blocks login | Clear error messaging; monitor IdP status |
| Double-booking under concurrency | Transactional conflict checks and database constraints across schedule changes |
| No-show abuse | Max active bookings; no-show tracking (FR-03.6) |
| Weather API dependency (bonus) | Graceful degradation; feature flagged |
| Scope creep from "custom view" report | Define metrics list up front; timebox |

---

## 11. Glossary

- **Slot:** A 30-minute bookable unit of a facility.
- **Blocked booking:** A booking prevented or invalidated by an Admin.
- **Active booking:** A future booking in confirmed state or pending state before its approval deadline.
- **Closure:** A maintenance-driven period during which a facility is unbookable.

---
