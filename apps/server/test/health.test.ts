import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module.js"
import { configureApp } from "../src/configure-app.js"

describe("GET /api/health", () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("reports the API and database as up", async () => {
    const response = await request(app.getHttpServer()).get("/api/health")

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: "ok", database: "up" })
  })

  it("keeps unknown API routes as JSON 404s", async () => {
    const response = await request(app.getHttpServer()).get("/api/missing")

    expect(response.status).toBe(404)
    expect(response.type).toMatch(/json/)
  })
})
