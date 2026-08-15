"use strict";

require("./setup");

const request = require("supertest");

jest.mock("../app/services/llm-resolver", () => {
  const actual = jest.requireActual("../app/services/llm-resolver");
  return {
    ...actual,
    testByokConnection: jest.fn().mockResolvedValue({
      ok: true,
      latencyMs: 42,
      sample: "pong",
    }),
  };
});

const app = require("../app");

describe("BYOK API", () => {
  const testUser = {
    name: `byokuser_${Date.now()}`,
    password: "testpass123",
  };
  let authToken;

  beforeAll(async () => {
    await request(app).post("/api/auth/register").send(testUser);
    const loginRes = await request(app).post("/api/auth/login").send(testUser);
    authToken = loginRes.body.data.token;
  });

  describe("Auth", () => {
    it("should reject unauthenticated GET /api/byok", async () => {
      const res = await request(app).get("/api/byok");
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated PUT /api/byok", async () => {
      const res = await request(app)
        .put("/api/byok")
        .send({ baseUrl: "https://x", apiKey: "sk-1234abcd", model: "x" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/byok", () => {
    it("should return disabled state for fresh user", async () => {
      const res = await request(app).get("/api/byok").set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(false);
      expect(res.body.data.baseUrl).toBeNull();
      expect(res.body.data.model).toBeNull();
      expect(res.body.data.apiKeyMasked).toBeNull();
      expect(res.body.data.thinkingEnabled).toBe(false);
      expect(res.body.data.visionEnabled).toBe(false);
    });
  });

  describe("PUT /api/byok", () => {
    it("should reject invalid baseUrl", async () => {
      const res = await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          enabled: true,
          baseUrl: "not-a-url",
          apiKey: "sk-12345678",
          model: "gpt-4o-mini",
        });
      expect(res.status).toBe(400);
    });

    it("should reject non-http(s) baseUrl", async () => {
      const res = await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          enabled: true,
          baseUrl: "ftp://example.com",
          apiKey: "sk-12345678",
          model: "gpt-4o-mini",
        });
      expect(res.status).toBe(400);
    });

    it("should reject short apiKey", async () => {
      const res = await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          enabled: true,
          baseUrl: "https://api.openai.com/v1",
          apiKey: "short",
          model: "gpt-4o-mini",
        });
      expect(res.status).toBe(400);
    });

    it("should reject empty model", async () => {
      const res = await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          enabled: true,
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-12345678",
          model: "",
        });
      expect(res.status).toBe(400);
    });

    it("should reject non-boolean thinkingEnabled", async () => {
      const res = await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          enabled: true,
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-12345678",
          model: "gpt-4o-mini",
          thinkingEnabled: "yes",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/thinkingEnabled/);
    });

    it("should reject non-boolean visionEnabled", async () => {
      const res = await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          enabled: true,
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-12345678",
          model: "gpt-4o-mini",
          visionEnabled: 1,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/visionEnabled/);
    });

    it("should accept valid config and persist flags", async () => {
      const res = await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          enabled: true,
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-1234567890abcdef",
          model: "gpt-4o-mini",
          thinkingEnabled: true,
          visionEnabled: true,
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("byokEnabled", true);
      expect(res.body.data).toHaveProperty("byokThinkingEnabled", true);
      expect(res.body.data).toHaveProperty("byokVisionEnabled", true);
    });

    it("should allow updating only flags without apiKey", async () => {
      const res = await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          thinkingEnabled: false,
          visionEnabled: false,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.byokThinkingEnabled).toBe(false);
      expect(res.body.data.byokVisionEnabled).toBe(false);
    });
  });

  describe("GET /api/byok after set", () => {
    it("should return masked key, baseUrl/model, and flag states", async () => {
      await request(app)
        .put("/api/byok")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          enabled: true,
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-1234567890abcdef",
          model: "gpt-4o-mini",
          thinkingEnabled: true,
          visionEnabled: false,
        });
      const res = await request(app).get("/api/byok").set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.baseUrl).toBe("https://api.openai.com/v1");
      expect(res.body.data.model).toBe("gpt-4o-mini");
      expect(res.body.data.apiKeyMasked).toMatch(/^sk-/);
      expect(res.body.data.apiKeyMasked).not.toBe("sk-1234567890abcdef");
      expect(res.body.data.thinkingEnabled).toBe(true);
      expect(res.body.data.visionEnabled).toBe(false);
    });
  });

  describe("POST /api/byok/test", () => {
    it("should validate missing fields", async () => {
      const res = await request(app)
        .post("/api/byok/test")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ baseUrl: "https://x.com", apiKey: "sk-12345678" });
      expect(res.status).toBe(400);
    });

    it("should call testByokConnection with provided values", async () => {
      const { testByokConnection } = require("../app/services/llm-resolver");
      const res = await request(app)
        .post("/api/byok/test")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-abcdefgh1234",
          model: "gpt-4o-mini",
        });
      expect(res.status).toBe(200);
      expect(testByokConnection).toHaveBeenCalledWith({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-abcdefgh1234",
        model: "gpt-4o-mini",
      });
      expect(res.body.data.ok).toBe(true);
    });
  });

  describe("DELETE /api/byok", () => {
    it("should disable BYOK and clear config + flags", async () => {
      const res = await request(app)
        .delete("/api/byok")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      const status = await request(app)
        .get("/api/byok")
        .set("Authorization", `Bearer ${authToken}`);
      expect(status.body.data.enabled).toBe(false);
      expect(status.body.data.thinkingEnabled).toBe(false);
      expect(status.body.data.visionEnabled).toBe(false);
    });
  });
});
