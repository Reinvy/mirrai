"use strict";

require("./setup");

const request = require("supertest");
const { prisma } = require("../app/config/db");

// Mock the AI chain calls to avoid OpenRouter dependency in tests
jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest
    .fn()
    .mockResolvedValue({ emotion: "happy", confidence: 0.8 }),
}));
jest.mock("../app/services/thought", () => ({
  generateThought: jest
    .fn()
    .mockResolvedValue("Memikirkan respons yang tepat..."),
}));
jest.mock("../app/services/decision", () => ({
  generateDecision: jest
    .fn()
    .mockResolvedValue("Ini adalah respons test dari MirrAI."),
}));

const app = require("../app");

describe("Personality History API", () => {
  let authToken;
  let userId;
  let userName;

  beforeAll(async () => {
    userName = `histuser_${Date.now()}`;
    await request(app)
      .post("/api/auth/register")
      .send({ name: userName, password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name: userName, password: "testpass123" });
    authToken = loginRes.body.data.token;
    userId = loginRes.body.data.user.id;
  });

  describe("Registration Initial Snapshot", () => {
    it("should create an initial snapshot in history upon registration", async () => {
      const history = await prisma.personalityHistory.findMany({
        where: { userId },
      });
      expect(history.length).toBe(1);
      expect(history[0]).toHaveProperty("empathy", 0.5);
      expect(history[0]).toHaveProperty("logic", 0.5);
      expect(history[0]).toHaveProperty("humor", 0.5);
      expect(history[0]).toHaveProperty("confidence", 0.5);
      expect(history[0]).toHaveProperty("playfulness", 0.5);
    });
  });

  describe("GET /api/personality/:userId/history", () => {
    it("should retrieve historical snapshots", async () => {
      const res = await request(app)
        .get(`/api/personality/${userId}/history`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toHaveProperty("empathy");
      expect(res.body.data[0]).toHaveProperty("createdAt");
    });

    it("should limit the number of returned snapshots", async () => {
      // Add a couple more manually
      await prisma.personalityHistory.create({
        data: { userId, empathy: 0.6, logic: 0.6, humor: 0.6, confidence: 0.6, playfulness: 0.6 },
      });
      await prisma.personalityHistory.create({
        data: { userId, empathy: 0.7, logic: 0.7, humor: 0.7, confidence: 0.7, playfulness: 0.7 },
      });

      const res = await request(app)
        .get(`/api/personality/${userId}/history?limit=2`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      // Verify ordering is oldest first (reversing returned chronological oldest-first list)
      expect(res.body.data[0].empathy).toBe(0.6);
      expect(res.body.data[1].empathy).toBe(0.7);
    });
  });

  describe("PUT /api/personality/:userId", () => {
    it("should log a new snapshot in history when traits are updated", async () => {
      const updateRes = await request(app)
        .put(`/api/personality/${userId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          empathy: 0.8,
          logic: 0.2,
        });
      expect(updateRes.status).toBe(200);

      // Verify that history has logged the new state
      const history = await prisma.personalityHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      // The latest snapshot should reflect the manual update
      expect(history[0].empathy).toBe(0.8);
      expect(history[0].logic).toBe(0.2);
    });
  });

  describe("Chat Evolution Snapshot Trigger", () => {
    it("should log a new snapshot when chat pipeline causes personality to evolve", async () => {
      // Get the current traits
      const curPersonality = await prisma.personality.findUnique({
        where: { userId },
      });

      // Send chat message (Mocked emotion is 'happy' with confidence 0.8)
      // Happy emotion weights: empathy +0.02, logic +0.01, humor +0.05, confidence +0.05, playfulness +0.05
      // Change = weight * factor (0.8)
      const res = await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "Ayo kita bersenang-senang!" });

      expect(res.status).toBe(200);

      // Wait a moment for database writes
      await new Promise((resolve) => setTimeout(resolve, 50));

      const evolvedPersonality = await prisma.personality.findUnique({
        where: { userId },
      });

      // Verify that traits changed
      expect(evolvedPersonality.humor).toBeGreaterThan(curPersonality.humor);

      // Verify history contains a snapshot representing this evolved state
      const history = await prisma.personalityHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      expect(history[0].humor).toBe(evolvedPersonality.humor);
      expect(history[0].empathy).toBe(evolvedPersonality.empathy);
    });
  });
});
