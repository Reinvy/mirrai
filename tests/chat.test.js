"use strict";

require("./setup");

const request = require("supertest");

// Mock the AI chain calls to avoid OpenRouter dependency in tests
jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest
    .fn()
    .mockResolvedValue({ emotion: "neutral", confidence: 0.8 }),
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
jest.mock("../app/services/evolution", () => ({
  evolvePersonality: jest.fn().mockResolvedValue({}),
}));

const app = require("../app");

describe("Chat API", () => {
  let authToken;

  beforeAll(async () => {
    const name = `chatuser_${Date.now()}`;
    await request(app)
      .post("/api/auth/register")
      .send({ name, password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    authToken = loginRes.body.data.token;
  });

  describe("POST /api/chat", () => {
    it("should process a chat message and return response", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "Halo, aku lagi sedih nih" });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("response");
      expect(res.body.data).toHaveProperty("emotion");
      expect(res.body.data).toHaveProperty("personality_snapshot");
    });

    it("should reject empty message", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "" });
      expect(res.status).toBe(400);
    });

    it("should reject missing message", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request(app)
        .post("/api/chat")
        .send({ message: "test" });
      expect(res.status).toBe(401);
    });
  });
});
