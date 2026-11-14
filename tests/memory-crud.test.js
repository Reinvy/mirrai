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

  describe("GET /api/memory/me with search query", () => {
    it("should filter memories by search query", async () => {
      const res = await request(app)
        .get("/api/memory/me?query=teh")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // It should match since teh is in "Aku suka sekali minum teh hangat"
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PUT /api/personality/me", () => {
    it("should update user personality traits successfully", async () => {
      const res = await request(app)
        .put("/api/personality/me")
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
        .get("/api/memory/me")
        .set("Authorization", `Bearer ${authToken}`);
      const found = checkRes.body.data.find(m => m.id === memoryId);
      expect(found).toBeUndefined();
    });

    it("should 404 when deleting an unknown memory", async () => {
      const res = await request(app)
        .delete("/api/memory/does-not-exist")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });

    it("should not resurrect a deleted memory on update", async () => {
      const res = await request(app)
        .put(`/api/memory/${memoryId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "Mencoba menghidupkan lagi" });
      expect(res.status).toBe(404);
    });
  });

  describe("Memory associations", () => {
    it("persists associations and emotional valence on create and update", async () => {
      const created = await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "Suka berjalan pagi di taman",
          type: "SEMANTIC",
          associations: ["pagi", "kesehatan"],
          emotionalValence: 0.4,
        });
      expect(created.status).toBe(201);
      expect(created.body.data.associations).toEqual(["pagi", "kesehatan"]);

      const updated = await request(app)
        .put(`/api/memory/${created.body.data.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ associations: ["pagi", "rutinitas"], emotionalValence: -0.2 });
      expect(updated.status).toBe(200);
      expect(updated.body.data.associations).toEqual(["pagi", "rutinitas"]);
      expect(updated.body.data.emotionalValence).toBeCloseTo(-0.2);

      const listed = await request(app)
        .get("/api/memory/me")
        .set("Authorization", `Bearer ${authToken}`);
      const found = listed.body.data.find((m) => m.id === created.body.data.id);
      expect(found.associations).toEqual(["pagi", "rutinitas"]);
    });

    it("rejects a memory id owned by someone else", async () => {
      const otherName = `other_mem_${Date.now().toString(36)}`;
      await request(app)
        .post("/api/auth/register")
        .send({ name: otherName, password: "testpass123" });
      const otherLogin = await request(app)
        .post("/api/auth/login")
        .send({ name: otherName, password: "testpass123" });
      const otherToken = otherLogin.body.data.token;

      const created = await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ content: "Memori milik orang lain", type: "SEMANTIC" });

      const res = await request(app)
        .put(`/api/memory/${created.body.data.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "Dibajak" });
      expect(res.status).toBe(404);
    });

    it("rejects an invalid graph threshold", async () => {
      const res = await request(app)
        .get("/api/memory/graph?threshold=0.2")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(400);
    });
  });
});
