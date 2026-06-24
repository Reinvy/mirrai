"use strict";

require("./setup");

const request = require("supertest");
const app = require("../app");

describe("Me endpoints", () => {
  let token;
  let userId;

  beforeAll(async () => {
    const name = `me_${Date.now().toString(36)}`;
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name, password: "testpass123" });
    expect(reg.status).toBe(201);
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.token;
    userId = loginRes.body.data.user.id;
  });

  describe("GET /api/auth/me", () => {
    it("should return user info with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("id", userId);
      expect(res.body.data).toHaveProperty("name");
    });

    it("should 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/memory/me", () => {
    it("should return user's memories", async () => {
      // Add a memory first
      await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Test memory", type: "SEMANTIC" });

      const res = await request(app)
        .get("/api/memory/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should 401 without token", async () => {
      const res = await request(app).get("/api/memory/me");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/personality/me", () => {
    it("should return default personality", async () => {
      const res = await request(app)
        .get("/api/personality/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("empathy", 0.5);
      expect(res.body.data).toHaveProperty("logic", 0.5);
    });

    it("should 401 without token", async () => {
      const res = await request(app).get("/api/personality/me");
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/personality/me", () => {
    it("should update personality and save snapshot", async () => {
      const res = await request(app)
        .put("/api/personality/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ empathy: 0.7, logic: 0.8 });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("empathy", 0.7);
      expect(res.body.data).toHaveProperty("logic", 0.8);
    });
  });

  describe("GET /api/personality/me/history", () => {
    it("should return history entries", async () => {
      const res = await request(app)
        .get("/api/personality/me/history")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should support from/to date filter", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/personality/me/history?from=${today}&to=${today}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should reject invalid date", async () => {
      const res = await request(app)
        .get("/api/personality/me/history?from=notadate")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/personality/me/reset", () => {
    it("should reset personality to default", async () => {
      const res = await request(app)
        .post("/api/personality/me/reset")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("empathy", 0.5);
    });
  });

  describe("PUT /api/auth/password", () => {
    it("should change password and invalidate token", async () => {
      const newName = `pw_${Date.now().toString(36)}`;
      await request(app)
        .post("/api/auth/register")
        .send({ name: newName, password: "oldpass1234" });
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ name: newName, password: "oldpass1234" });
      const oldToken = loginRes.body.data.token;

      const res = await request(app)
        .put("/api/auth/password")
        .set("Authorization", `Bearer ${oldToken}`)
        .send({ oldPassword: "oldpass1234", newPassword: "newpass5678" });
      expect(res.status).toBe(200);

      // Old token should now be invalid
      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${oldToken}`);
      expect(meRes.status).toBe(401);

      // Login with new password should work
      const reLogin = await request(app)
        .post("/api/auth/login")
        .send({ name: newName, password: "newpass5678" });
      expect(reLogin.status).toBe(200);
    });

    it("should reject wrong old password", async () => {
      const res = await request(app)
        .put("/api/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: "wrongpass99", newPassword: "newpass1234" });
      expect(res.status).toBe(401);
    });

    it("should reject new password < 8 chars", async () => {
      const res = await request(app)
        .put("/api/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: "testpass123", newPassword: "short" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/auth/me/export", () => {
    it("should return user data as JSON", async () => {
      const res = await request(app)
        .get("/api/auth/me/export")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("memories");
      expect(res.body).toHaveProperty("personality");
    });
  });

  describe("DELETE /api/auth/me", () => {
    it("should soft-delete user account", async () => {
      const delName = `del_${Date.now().toString(36)}`;
      await request(app)
        .post("/api/auth/register")
        .send({ name: delName, password: "delpass1234" });
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ name: delName, password: "delpass1234" });
      const delToken = loginRes.body.data.token;

      const res = await request(app)
        .delete("/api/auth/me")
        .set("Authorization", `Bearer ${delToken}`);
      expect(res.status).toBe(200);

      // Login should now fail (user is soft-deleted)
      const reLogin = await request(app)
        .post("/api/auth/login")
        .send({ name: delName, password: "delpass1234" });
      expect(reLogin.status).toBe(401);
    });
  });
});
