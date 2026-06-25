"use strict";

require("./setup");

const request = require("supertest");

// Mock the AI chain calls to avoid OpenRouter dependency in tests
jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest.fn().mockResolvedValue({ emotion: "neutral", confidence: 0.8 }),
}));
jest.mock("../app/services/thought", () => ({
  generateThought: jest.fn().mockResolvedValue("Memikirkan respons yang tepat..."),
}));
jest.mock("../app/services/response", () => {
  const defaultText = "Ini adalah respons test dari MirrAI.";

  async function* defaultGen() {
    for (const word of defaultText.split(" ")) {
      yield word + " ";
    }
  }

  const state = { impl: defaultGen };

  function streamResponse() {
    return state.impl();
  }
  streamResponse.__setImpl = (fn) => {
    state.impl = fn;
  };
  streamResponse.__resetImpl = () => {
    state.impl = defaultGen;
  };

  return {
    generateResponse: jest.fn().mockResolvedValue(defaultText),
    streamResponse,
  };
});
jest.mock("../app/services/evolution", () => ({
  evolvePersonality: jest.fn().mockResolvedValue({}),
}));

const app = require("../app");

describe("Chat API", () => {
  let authToken;

  beforeAll(async () => {
    const name = `chatuser_${Date.now()}`;
    await request(app).post("/api/auth/register").send({ name, password: "testpass123" });
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
      const res = await request(app).post("/api/chat").send({ message: "test" });
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
      const res = await request(app).post("/api/chat/stream").send({ message: "test" });
      expect(res.status).toBe(401);
    });

    it("should preserve text when LLM streams one char at a time (regression)", async () => {
      const text = "Hai, Bro Programmer.";
      const response = require("../app/services/response");
      response.streamResponse.__setImpl(async function* () {
        for (const ch of text) yield ch;
      });

      try {
        const res = await request(app)
          .post("/api/chat/stream")
          .set("Authorization", `Bearer ${authToken}`)
          .set("Accept", "text/event-stream")
          .send({ message: "halo single-char test" });

        expect(res.status).toBe(200);

        const lines = res.text.split("\n").filter((l) => l.startsWith("data: "));
        const events = lines.map((l) => JSON.parse(l.slice(6)));

        const done = events.find((e) => e.event === "done");
        const deltas = events.filter((e) => e.event === "delta").map((e) => e.text);

        expect(deltas.join("")).toBe(text);
        expect(done.response).toBe(text);
      } finally {
        response.streamResponse.__resetImpl();
      }
    });
  });
});
