"use strict";

require("./setup");

const request = require("supertest");
const app = require("../app");

describe("Security API", () => {
  let authToken;

  beforeAll(async () => {
    const name = `s_${Date.now().toString(36)}`;
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name, password: "securepass123" });
    if (reg.status !== 201) {
      throw new Error(
        `Register failed: ${reg.status} ${JSON.stringify(reg.body)}`,
      );
    }
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "securepass123" });
    if (loginRes.status !== 200) {
      throw new Error(
        `Login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
      );
    }
    authToken = loginRes.body.data.token;
  });

  describe("Max-length validation", () => {
    it("should reject name > 32 chars", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "a".repeat(33), password: "validpass123" });
      expect(res.status).toBe(400);
    });

    it("should reject password < 8 chars", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "validuser2", password: "short" });
      expect(res.status).toBe(400);
    });

    it("should reject password > 128 chars", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "validuser3", password: "a".repeat(129) });
      expect(res.status).toBe(400);
    });

    it("should reject message > 4000 chars", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "x".repeat(4001) });
      expect(res.status).toBe(400);
    });

    it("should reject memory content > 2000 chars", async () => {
      const res = await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "x".repeat(2001), type: "SEMANTIC" });
      expect(res.status).toBe(400);
    });
  });

  describe("Token invalidation", () => {
    it("should reject token after tokenVersion bump", async () => {
      const name = `t_${Date.now().toString(36)}`;
      await request(app)
        .post("/api/auth/register")
        .send({ name, password: "validpass123" });
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ name, password: "validpass123" });
      expect(loginRes.body.data).toHaveProperty("token");
      const token = loginRes.body.data.token;
      const meId = loginRes.body.data.user.id;

      const { prisma } = require("../app/config/db");
      await prisma.user.update({
        where: { id: meId },
        data: { tokenVersion: { increment: 1 } },
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/tidak valid|invalid/i);
    });
  });

  describe("Auth errors", () => {
    it("should reject request without Authorization header", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("should reject malformed Authorization header", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "NotBearer something");
      expect(res.status).toBe(401);
    });

    it("should reject garbage token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer garbage.token.here");
      expect(res.status).toBe(401);
    });
  });
});
