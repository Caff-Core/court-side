import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  GOOGLE_ISSUER,
  provisionFirstAdmin,
} from "../src/accounts/admin-provision.js"
import {
  createTestApp,
  identities,
  prismaOf,
  resetAccounts,
  signIn,
  signInOk,
} from "./helpers/app.js"

let app: INestApplication

beforeAll(async () => {
  app = await createTestApp()
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  await resetAccounts(app)
})

async function bootstrapAdmin() {
  await provisionFirstAdmin(prismaOf(app), {
    issuer: GOOGLE_ISSUER,
    subject: identities.admin.subject,
  })
  return signInOk(app, identities.admin)
}

async function accountIdOf(email: string) {
  const user = await prismaOf(app).user.findUniqueOrThrow({ where: { email } })
  return user.id
}

async function activeResident() {
  const admin = await bootstrapAdmin()
  const resident = await signInOk(app, identities.resident)
  const id = await accountIdOf(identities.resident.email)
  await admin.post(`/api/admin/accounts/${id}/approve`).expect(200)
  return { admin, resident, residentId: id }
}

describe("AC-001 identity bootstrap and approval", () => {
  it("makes the provisioned Google identity the active Admin on first sign-in", async () => {
    const admin = await bootstrapAdmin()

    const me = await admin.get("/api/me").expect(200)
    expect(me.body).toMatchObject({
      email: identities.admin.email,
      status: "active",
      role: "admin",
    })

    const provision = await prismaOf(app).adminProvision.findUniqueOrThrow({
      where: { id: 1 },
    })
    expect(provision.consumedAt).toBeInstanceOf(Date)
    expect(provision.userId).toBe(me.body.id)
  })

  it("grants Admin only once, even if setup runs again", async () => {
    await bootstrapAdmin()

    await expect(
      provisionFirstAdmin(prismaOf(app), {
        issuer: GOOGLE_ISSUER,
        subject: identities.resident.subject,
      })
    ).rejects.toThrow(/already provisioned/i)

    const resident = await signInOk(app, identities.resident)
    const me = await resident.get("/api/me").expect(200)
    expect(me.body).toMatchObject({ status: "pending", role: null })
  })

  it("creates other first sign-ins as pending accounts without a role", async () => {
    const pending = await signInOk(app, identities.pending)

    const me = await pending.get("/api/me").expect(200)
    expect(me.body).toMatchObject({
      email: identities.pending.email,
      status: "pending",
      role: null,
    })
  })

  it("rejects fixture sign-ins from another origin", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/identity-fixture/sign-in")
      .set("Origin", "http://evil.example")
      .send(identities.pending)

    expect(response.status).toBe(403)
    expect(await prismaOf(app).user.count()).toBe(0)
  })

  it("does not trust role or status sent with the sign-in", async () => {
    const { agent } = await signIn(app, {
      ...identities.pending,
      // @ts-expect-error extra fields a client might try to inject
      role: "admin",
      status: "active",
    })

    const me = await agent.get("/api/me").expect(200)
    expect(me.body).toMatchObject({ status: "pending", role: null })
  })

  it("lets an Admin approve a pending account as Resident", async () => {
    const admin = await bootstrapAdmin()
    const pending = await signInOk(app, identities.pending)
    const id = await accountIdOf(identities.pending.email)

    const approved = await admin
      .post(`/api/admin/accounts/${id}/approve`)
      .expect(200)
    expect(approved.body).toMatchObject({
      id,
      status: "active",
      role: "resident",
    })

    const me = await pending.get("/api/me").expect(200)
    expect(me.body).toMatchObject({ status: "active", role: "resident" })
  })

  it("rejects approving an account that is not pending", async () => {
    const { admin, residentId } = await activeResident()

    await admin.post(`/api/admin/accounts/${residentId}/approve`).expect(409)
  })

  it("lets an Admin change an active account's role", async () => {
    const { admin, resident, residentId } = await activeResident()

    const changed = await admin
      .patch(`/api/admin/accounts/${residentId}/role`)
      .send({ role: "staff" })
      .expect(200)
    expect(changed.body).toMatchObject({ role: "staff" })

    const me = await resident.get("/api/me").expect(200)
    expect(me.body.role).toBe("staff")
  })

  it("rejects an unknown role", async () => {
    const { admin, residentId } = await activeResident()

    await admin
      .patch(`/api/admin/accounts/${residentId}/role`)
      .send({ role: "owner" })
      .expect(400)
  })

  it("stops an Admin from removing their own Admin access", async () => {
    const admin = await bootstrapAdmin()
    const id = await accountIdOf(identities.admin.email)

    await admin
      .patch(`/api/admin/accounts/${id}/role`)
      .send({ role: "resident" })
      .expect(409)
    await admin.post(`/api/admin/accounts/${id}/revoke`).expect(409)
  })

  it("forbids non-Admins from approving or changing roles", async () => {
    const { resident } = await activeResident()
    const pending = await signInOk(app, identities.pending)
    const pendingId = await accountIdOf(identities.pending.email)

    await resident.post(`/api/admin/accounts/${pendingId}/approve`).expect(403)
    await pending.post(`/api/admin/accounts/${pendingId}/approve`).expect(403)
    await resident
      .patch(`/api/admin/accounts/${pendingId}/role`)
      .send({ role: "admin" })
      .expect(403)
    await request(app.getHttpServer())
      .post(`/api/admin/accounts/${pendingId}/approve`)
      .expect(401)
  })
})

describe("AC-002 revocation", () => {
  it("fails the revoked user's existing session on the next protected request", async () => {
    const { admin, resident, residentId } = await activeResident()
    await resident.get("/api/me").expect(200)

    const revoked = await admin
      .post(`/api/admin/accounts/${residentId}/revoke`)
      .expect(200)
    expect(revoked.body).toMatchObject({ status: "revoked" })

    await resident.get("/api/me").expect(401)
    const sessions = await prismaOf(app).session.count({
      where: { userId: residentId },
    })
    expect(sessions).toBe(0)
  })

  it("keeps a revoked user out after a fresh sign-in", async () => {
    const { admin, residentId } = await activeResident()
    await admin.post(`/api/admin/accounts/${residentId}/revoke`).expect(200)

    const { agent, response } = await signIn(app, identities.resident)

    expect(response.status).toBe(403)
    await agent.get("/api/me").expect(401)
    const sessions = await prismaOf(app).session.count({
      where: { userId: residentId },
    })
    expect(sessions).toBe(0)
  })
})

describe("AC-003 account administration and audit", () => {
  it("lets only Admins search accounts with status and role", async () => {
    const { admin, resident } = await activeResident()
    await signInOk(app, identities.pending)

    const all = await admin.get("/api/admin/accounts").expect(200)
    expect(all.body.total).toBe(3)

    const search = await admin
      .get("/api/admin/accounts")
      .query({ search: "riley" })
      .expect(200)
    expect(search.body.items).toHaveLength(1)
    expect(search.body.items[0]).toMatchObject({
      email: identities.resident.email,
      status: "active",
      role: "resident",
    })

    const pendingOnly = await admin
      .get("/api/admin/accounts")
      .query({ status: "pending" })
      .expect(200)
    expect(
      pendingOnly.body.items.map((a: { email: string }) => a.email)
    ).toEqual([identities.pending.email])

    await resident.get("/api/admin/accounts").expect(403)
    await request(app.getHttpServer()).get("/api/admin/accounts").expect(401)
  })

  it("records actor, action and time for approval, role change and revocation", async () => {
    const { admin, residentId } = await activeResident()
    const adminId = await accountIdOf(identities.admin.email)
    await admin
      .patch(`/api/admin/accounts/${residentId}/role`)
      .send({ role: "staff" })
      .expect(200)
    await admin.post(`/api/admin/accounts/${residentId}/revoke`).expect(200)

    const entries = await prismaOf(app).auditLog.findMany({
      where: { entityType: "user", entityId: residentId },
      orderBy: { createdAt: "asc" },
    })
    expect(entries.map((e) => [e.action, e.actorId])).toEqual([
      ["account_approved", adminId],
      ["account_role_changed", adminId],
      ["account_revoked", adminId],
    ])
    expect(entries[1]!.details).toEqual({ from: "resident", to: "staff" })
    for (const entry of entries) expect(entry.createdAt).toBeInstanceOf(Date)

    const viaApi = await admin
      .get("/api/admin/audit-log")
      .query({ entityId: residentId })
      .expect(200)
    expect(viaApi.body.items).toHaveLength(3)
    expect(viaApi.body.items[0]).toMatchObject({
      action: "account_revoked",
      actor: { id: adminId, name: identities.admin.name },
    })
  })

  it("audits the first Admin bootstrap", async () => {
    await bootstrapAdmin()
    const adminId = await accountIdOf(identities.admin.email)

    const actions = await prismaOf(app).auditLog.findMany({
      orderBy: { createdAt: "asc" },
      select: { action: true, entityId: true },
    })
    expect(actions).toEqual([
      { action: "admin_provisioned", entityId: "1" },
      { action: "admin_bootstrapped", entityId: adminId },
    ])
  })
})

describe("AC-004 pending access", () => {
  it("lets a pending user see their own status but nothing protected", async () => {
    await bootstrapAdmin()
    const pending = await signInOk(app, identities.pending)

    await pending.get("/api/me").expect(200)
    await pending.get("/api/admin/accounts").expect(403)
  })

  it("returns 401 from /api/me without a session", async () => {
    await request(app.getHttpServer()).get("/api/me").expect(401)
  })
})

describe("sign-in options", () => {
  it("reports Google as unavailable without credentials and lists fixture personas", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/auth-options")
      .expect(200)

    expect(response.body.google).toBe(false)
    expect(response.body.identityFixture.personas.length).toBeGreaterThan(0)
  })
})
