"use strict";

require("./setup");

const request = require("supertest");
const app = require("../app");

describe("Memory API", () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const name = `memoryuser_${Date.now()}`;
    await request(app)
      .post("/api/auth/register")
      .send({ name, password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    authToken = loginRes.body.data.token;
    userId = loginRes.body.data.user.id;
  });

  describe("POST /api/memory", () => {
    it("should create a memory successfully", async () => {
      const res = await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "Aku suka kopi pagi hari", type: "SEMANTIC" });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data).toHaveProperty(
        "content",
        "Aku suka kopi pagi hari",
      );
    });

    it("should reject invalid type", async () => {
      const res = await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "test", type: "INVALID_TYPE" });
      expect(res.status).toBe(400);
    });

    it("should reject empty content", async () => {
      const res = await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "", type: "SEMANTIC" });
      expect(res.status).toBe(400);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request(app)
        .post("/api/memory")
        .send({ content: "test", type: "SEMANTIC" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/memory/:userId", () => {
    it("should return user memories", async () => {
      const res = await request(app)
        .get(`/api/memory/${userId}`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request(app).get(`/api/memory/${userId}`);
      expect(res.status).toBe(401);
    });
  });
});
