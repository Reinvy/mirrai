"use strict";

require("./setup");

const request = require("supertest");

jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest
    .fn()
    .mockResolvedValue({ emotion: "happy", confidence: 0.8 }),
}));
jest.mock("../app/services/thought", () => ({
  generateThought: jest.fn().mockResolvedValue("mocked thought"),
}));
jest.mock("../app/services/decision", () => ({
  generateDecision: jest.fn().mockResolvedValue("mocked decision"),
}));

const app = require("../app");

describe("Insights API", () => {
  let token;

  beforeAll(async () => {
    const name = `ins_${Date.now().toString(36)}`;
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name, password: "inspass1234" });
    expect(reg.status).toBe(201);
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "inspass1234" });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.token;
  });

  describe("GET /api/chat/insights", () => {
    it("should return zero counts for fresh user", async () => {
      const res = await request(app)
        .get("/api/chat/insights")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("totalChats", 0);
      expect(res.body.data).toHaveProperty("chatsThisWeek", 0);
      expect(res.body.data).toHaveProperty("chatsThisMonth", 0);
      expect(res.body.data).toHaveProperty("dailyActivity");
      expect(Array.isArray(res.body.data.topEmotions)).toBe(true);
    });

    it("should 401 without token", async () => {
      const res = await request(app).get("/api/chat/insights");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/memory/insights", () => {
    it("should return zero counts for fresh user", async () => {
      const res = await request(app)
        .get("/api/memory/insights")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("totalMemories", 0);
      expect(res.body.data).toHaveProperty("byType");
      expect(Array.isArray(res.body.data.byType)).toBe(true);
      expect(Array.isArray(res.body.data.topImportant)).toBe(true);
    });

    it("should reflect created memories", async () => {
      await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Test memory 1", type: "SEMANTIC", importanceScore: 0.9 });
      await request(app)
        .post("/api/memory")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Test memory 2", type: "EMOTIONAL", importanceScore: 0.5 });

      const res = await request(app)
        .get("/api/memory/insights")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalMemories).toBe(2);
      expect(res.body.data.byType.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/personality/me/insights", () => {
    it("should return default insights", async () => {
      const res = await request(app)
        .get("/api/personality/me/insights")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("current");
      expect(res.body.data).toHaveProperty("summary");
      expect(res.body.data).toHaveProperty("trend");
    });

    it("should 401 without token", async () => {
      const res = await request(app).get("/api/personality/me/insights");
      expect(res.status).toBe(401);
    });
  });
});
