"use strict";

require("./setup");

const request = require("supertest");
const app = require("../app");

describe("Auth API", () => {
  const testUser = { name: `testuser_${Date.now()}`, password: "testpass123" };
  let authToken;

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const res = await request(app).post("/api/auth/register").send(testUser);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data).toHaveProperty("name", testUser.name);
    });

    it("should reject duplicate name", async () => {
      const res = await request(app).post("/api/auth/register").send(testUser);
      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty("status", "error");
    });

    it("should reject short name", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "a", password: "valid123" });
      expect(res.status).toBe(400);
    });

    it("should reject short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "validname", password: "123" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully and return token", async () => {
      const res = await request(app).post("/api/auth/login").send(testUser);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("token");
      expect(res.body.data).toHaveProperty("user");
      authToken = res.body.data.token;
    });

    it("should reject wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ name: testUser.name, password: "wrongpass" });
      expect(res.status).toBe(401);
    });

    it("should reject non-existent user", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ name: "nosuchuser", password: "pass123" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      if (!authToken) {
        const loginRes = await request(app)
          .post("/api/auth/login")
          .send(testUser);
        authToken = loginRes.body.data.token;
      }
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
    });

    it("should reject blacklisted token", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(401);
    });

    it("should reject request without token", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(401);
    });
  });
});
