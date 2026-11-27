# M01.01 verification — local app with verified access rules

Task 01.01.04 · 27 November 2026 · AC-001 to AC-004

## Environment

| Item | Value |
| --- | --- |
| Commit under test | `e3a2d08` on `main` (after #15 and #16) |
| OS | Fedora Linux 44 |
| Runtime | Node.js 24.22.1, Bun 1.3.12 |
| Database | PostgreSQL 18.7 (`postgres:18-alpine`, Docker Compose, port 5433) |
| Browser | Chromium 157, headless, driven by Playwright |
| Fresh databases | `court_side_verify` and `court_side_verify_test`, created empty for this run, migrated and seeded, then dropped |
| Sign-in | Local identity fixture (`AUTH_IDENTITY_FIXTURE=true`), which runs the Google callback's account path. First Admin provisioned with `admin:provision --subject fixture-admin` |

## Continuous integration

| Commit | Run | Result |
| --- | --- | --- |
| `e3a2d08` public availability (#16) | [45976225741](https://github.com/Caff-Core/court-side/actions/runs/45976225741) | Pass |
| `d5bb39f` sign-in and authorization (#15) | [45972697191](https://github.com/Caff-Core/court-side/actions/runs/45972697191) | Pass |

## Automated checks on the fresh database

`bun run test` with `DATABASE_URL` pointing at `court_side_verify`: server 5 files (48 tests) and web 3 files (13 tests) pass. The server suite covers AC-001 to AC-004 with request tests against PostgreSQL and a controlled clock.

## Browser walkthrough on the fresh database

| Check | Expected | Actual | Result |
| --- | --- | --- | --- |
| AC-004 anonymous keyboard browse | Keyboard alone reaches the facilities, switches facility and moves to the next day | 5 Tab presses reach the facility radios; ArrowDown selects Maple Grove Tennis Court 1; Enter on Next day moves from Friday, November 27 to Saturday, November 28 | Pass |
| AC-004 no booker details | Public page shows statuses only | Page text holds no account names or emails | Pass |
| AC-001 first Admin | The provisioned identity becomes the active Admin on first sign-in | `status=active`, `role=admin` | Pass |
| AC-001 other first sign-ins | Pending, no role | Riley Resident lands on `/account` as pending with no role | Pass |
| AC-004 pending access | Pending user sees approval status and cannot reach Admin features | `/admin/accounts` redirects to `/account`; `GET /api/admin/accounts` returns 403; schedule shows "Waiting for approval" | Pass |
| AC-001 approval | An Admin approves a pending account as Resident | Approved through the row menu with the keyboard; Riley becomes `active` Resident | Pass |
| AC-001 only Admins approve | A Resident is refused | `POST /api/admin/accounts/:id/approve` as Riley returns 403 | Pass |
| AC-002 existing session | Revocation fails the next protected request | Sam Staff active before; after revoking through the confirmation dialog, `GET /api/me` returns 401; the public schedule still answers 200 | Pass |
| AC-002 fresh sign-in | A new sign-in cannot regain access | Fresh fixture sign-in returns to `/sign-in`; `GET /api/me` returns 401 | Pass |
| AC-003 audit | Approval, revocation and bootstrap record actor, action and time | Audit log holds `admin_provisioned`, `admin_bootstrapped`, `account_approved`, `account_revoked`, each with actor and timestamp | Pass |

## Defect found and fixed

The root `db:migrate` and `db:reset` scripts used `bun --cwd apps/server run <script>`. Bun reads `--cwd` before `run` as a flag of its own and prints its help instead of running the script. They now use `bun run --cwd apps/server <script>`, as do the README commands for `admin:provision` and `db:seed:demo`.

## Manual Google sign-in

| Check | Expected | Actual | Result |
| --- | --- | --- | --- |
| AC-001 real Google smoke test | Signing in with the configured Google account in the normal local configuration makes that identity the first Admin | Not run: no Google OAuth client is configured yet | **Pending** |

To finish this check: set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` with the redirect URI `http://localhost:5180/api/auth/callback/google` (match `APP_URL`), provision the first Admin with that account's Google subject, sign in once, and record the commit and result here.
