"use strict";

require("./setup");

const request = require("supertest");

jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest.fn().mockResolvedValue({ emotion: "neutral", confidence: 0.8 }),
}));
jest.mock("../app/services/response", () => {
  const defaultText = "Ini adalah respons test dari MirrAI.";

  async function* defaultGen() {
    for (const word of defaultText.split(" ")) {
      yield { type: "delta", text: word + " " };
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
    generateResponse: jest.fn().mockResolvedValue({ text: defaultText, reasoning: null }),
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
      expect(res.body.data).toHaveProperty("reasoning", null);
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

    it("should reject attachments when vision is disabled (default)", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          message: "Lihat gambar",
          attachments: [
            {
              type: "image",
              dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
              mimeType: "image/png",
            },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/vision/i);
    });
  });

  describe("POST /api/chat/stream", () => {
    it("should stream events: meta, delta*, done", async () => {
      const res = await request(app)
        .post("/api/chat/stream")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Accept", "text/event-stream")
        .send({ message: "Halo streaming test" });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

      const lines = res.text.split("\n").filter((l) => l.startsWith("data: "));
      const events = lines.map((l) => JSON.parse(l.slice(6)));

      const eventTypes = events.map((e) => e.event);
      expect(eventTypes[0]).toBe("meta");
      expect(eventTypes).toContain("done");
      expect(eventTypes.filter((t) => t === "delta").length).toBeGreaterThan(0);

      const done = events.find((e) => e.event === "done");
      expect(done).toHaveProperty("response");
      expect(done).toHaveProperty("emotion");
      expect(done).toHaveProperty("personality_snapshot");
      expect(done).toHaveProperty("threadId");
      expect(done).toHaveProperty("reasoning");

      const deltas = events.filter((e) => e.event === "delta").map((e) => e.text);
      expect(deltas.join("")).toBe(done.response);
    });

    it("should stream reasoning events when provider returns reasoning_content", async () => {
      const text = "Hai, twin kamu di sini.";
      const reasoning = "Pikirkan konteks user, lalu jawab singkat.";

      const response = require("../app/services/response");
      response.streamResponse.__setImpl(async function* () {
        yield { type: "reasoning", text: "Pikirkan konteks user, " };
        yield { type: "reasoning", text: "lalu jawab singkat." };
        for (const ch of text) yield { type: "delta", text: ch };
      });

      try {
        const res = await request(app)
          .post("/api/chat/stream")
          .set("Authorization", `Bearer ${authToken}`)
          .set("Accept", "text/event-stream")
          .send({ message: "halo reasoning test" });

        expect(res.status).toBe(200);

        const lines = res.text.split("\n").filter((l) => l.startsWith("data: "));
        const events = lines.map((l) => JSON.parse(l.slice(6)));

        const reasoningEvents = events.filter((e) => e.event === "reasoning");
        expect(reasoningEvents.length).toBeGreaterThan(0);
        const joinedReasoning = reasoningEvents.map((e) => e.reasoning).join("");
        expect(joinedReasoning).toBe(reasoning);

        const done = events.find((e) => e.event === "done");
        expect(done.reasoning).toBe(reasoning);

        const deltas = events.filter((e) => e.event === "delta").map((e) => e.text);
        expect(deltas.join("")).toBe(text);
        expect(done.response).toBe(text);
      } finally {
        response.streamResponse.__resetImpl();
      }
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
        for (const ch of text) yield { type: "delta", text: ch };
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
