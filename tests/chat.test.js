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
  streamDecision: (() => {
    async function* gen() {
      const text = "Ini adalah respons test dari MirrAI.";
      for (const word of text.split(" ")) {
        yield word + " ";
      }
    }
    return gen;
  })(),
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

  describe("POST /api/chat/stream", () => {
    it("should stream events: meta, reasoning, delta*, done", async () => {
      const res = await request(app)
        .post("/api/chat/stream")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Accept", "text/event-stream")
        .send({ message: "Halo streaming test" });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

      const lines = res.text.split("\n").filter((l) => l.startsWith("data: "));
      const events = lines.map((l) => JSON.parse(l.slice(6)));

      // Expect at least meta, reasoning, one delta, done
      const eventTypes = events.map((e) => e.event);
      expect(eventTypes[0]).toBe("meta");
      expect(eventTypes).toContain("reasoning");
      expect(eventTypes).toContain("done");
      expect(eventTypes.filter((t) => t === "delta").length).toBeGreaterThan(0);

      const done = events.find((e) => e.event === "done");
      expect(done).toHaveProperty("response");
      expect(done).toHaveProperty("emotion");
      expect(done).toHaveProperty("personality_snapshot");
      expect(done).toHaveProperty("threadId");

      // Verify the streamed response reconstructed equals the final response
      const deltas = events.filter((e) => e.event === "delta").map((e) => e.text);
      expect(deltas.join("")).toBe(done.response);
    });

    it("should reject empty message", async () => {
      const res = await request(app)
        .post("/api/chat/stream")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "" });
      expect(res.status).toBe(400);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request(app)
        .post("/api/chat/stream")
        .send({ message: "test" });
      expect(res.status).toBe(401);
    });
  });
});
