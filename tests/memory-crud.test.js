"use strict";

require("./setup");

const request = require("supertest");
const app = require("../app");

describe("Memory CRUD and Personality API", () => {
  let authToken;
  let userId;
  let memoryId;

  beforeAll(async () => {
    const name = `cruduser_${Date.now()}`;
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
        .send({ content: "Aku suka minum kopi susu", type: "SEMANTIC", importanceScore: 0.8 });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      memoryId = res.body.data.id;
    });
  });

  describe("PUT /api/memory/:memoryId", () => {
    it("should update memory content, type and score successfully", async () => {
      const res = await request(app)
        .put(`/api/memory/${memoryId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "Aku suka sekali minum teh hangat", type: "SEMANTIC", importanceScore: 0.9 });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("content", "Aku suka sekali minum teh hangat");
      expect(res.body.data).toHaveProperty("importanceScore", 0.9);
    });

    it("should reject update with empty content", async () => {
      const res = await request(app)
        .put(`/api/memory/${memoryId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "" });
      expect(res.status).toBe(400);
    });

    it("should reject update with invalid type", async () => {
      const res = await request(app)
        .put(`/api/memory/${memoryId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ type: "UNKNOWN_TYPE" });
      expect(res.status).toBe(400);
    });

    it("should reject update with invalid importanceScore", async () => {
      const res = await request(app)
        .put(`/api/memory/${memoryId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ importanceScore: 5.5 });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/memory/:userId with search query", () => {
    it("should filter memories by search query", async () => {
      const res = await request(app)
        .get(`/api/memory/${userId}?query=teh`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // It should match since teh is in "Aku suka sekali minum teh hangat"
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PUT /api/personality/:userId", () => {
    it("should update user personality traits successfully", async () => {
      const res = await request(app)
        .put(`/api/personality/${userId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ empathy: 0.8, logic: 0.7, humor: 0.9, confidence: 0.85, playfulness: 0.6 });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("empathy", 0.8);
      expect(res.body.data).toHaveProperty("logic", 0.7);
      expect(res.body.data).toHaveProperty("humor", 0.9);
      expect(res.body.data).toHaveProperty("confidence", 0.85);
      expect(res.body.data).toHaveProperty("playfulness", 0.6);
    });
  });

  describe("DELETE /api/memory/:memoryId", () => {
    it("should soft delete memory successfully", async () => {
      const res = await request(app)
        .delete(`/api/memory/${memoryId}`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);

      // Verify that it is no longer returned in the general list
      const checkRes = await request(app)
        .get(`/api/memory/${userId}`)
        .set("Authorization", `Bearer ${authToken}`);
      const found = checkRes.body.data.find(m => m.id === memoryId);
      expect(found).toBeUndefined();
    });
  });
});
