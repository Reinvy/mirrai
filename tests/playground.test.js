"use strict";

require("./setup");

const request = require("supertest");

// Mock the AI chain calls to avoid OpenRouter/OpenAI dependency in tests
jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest
    .fn()
    .mockResolvedValue({ emotion: "neutral", confidence: 0.8 }),
}));
jest.mock("../app/services/thought", () => ({
  generateThought: jest
    .fn()
    .mockResolvedValue("Memikirkan respons simulasi..."),
}));
jest.mock("../app/services/decision", () => ({
  generateDecision: jest
    .fn()
    .mockResolvedValue("Ini adalah respons simulasi replika."),
}));
jest.mock("../app/services/evolution", () => ({
  evolvePersonality: jest.fn().mockResolvedValue({}),
}));
jest.mock("../app/llm/chains/assistant-chain", () => ({
  assistantChain: {
    invoke: jest.fn().mockResolvedValue("Ini adalah respons asisten standard."),
  },
}));

const app = require("../app");

describe("Playground Simulation API", () => {
  let authToken;

  beforeAll(async () => {
    const name = `playuser_${Date.now()}`;
    await request(app)
      .post("/api/auth/register")
      .send({ name, password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    authToken = loginRes.body.data.token;
  });

  describe("POST /api/chat/playground", () => {
    it("should run simulation and return both twin and assistant outputs", async () => {
      const res = await request(app)
        .post("/api/chat/playground")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "Skenario uji coba" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("twin");
      expect(res.body.data).toHaveProperty("assistant");
      expect(res.body.data.twin).toHaveProperty("response", "Ini adalah respons simulasi replika.");
      expect(res.body.data.twin).toHaveProperty("reasoning", "Memikirkan respons simulasi...");
      expect(res.body.data.twin.emotion).toHaveProperty("emotion", "neutral");
      expect(res.body.data.assistant).toHaveProperty("response", "Ini adalah respons asisten standard.");
    });

    it("should reject empty message", async () => {
      const res = await request(app)
        .post("/api/chat/playground")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "" });
      expect(res.status).toBe(400);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request(app)
        .post("/api/chat/playground")
        .send({ message: "test" });
      expect(res.status).toBe(401);
    });
  });
});
