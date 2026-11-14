"use strict";

require("./setup");

const request = require("supertest");
const { prisma } = require("../app/config/db");
const { getQuotaStatus } = require("../app/services/quota");

jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest.fn().mockResolvedValue({ emotion: "neutral", confidence: 0.8 }),
}));
jest.mock("../app/services/memory-extraction", () => ({
  extractMemories: jest.fn().mockResolvedValue([]),
}));
jest.mock("../app/services/response", () => ({
  generateResponse: jest
    .fn()
    .mockResolvedValue({ text: "Respons test kuota.", reasoning: null }),
  streamResponse: async function* empty() {},
}));
jest.mock("../app/services/evolution", () => ({
  evolvePersonality: jest.fn().mockResolvedValue({}),
}));
jest.mock("../app/llm/chains/assistant-chain", () => ({
  assistantChain: {
    invoke: jest.fn().mockResolvedValue("Respons asisten test."),
  },
}));
jest.mock("../app/modules/chat/thread-service", () => {
  const original = jest.requireActual("../app/modules/chat/thread-service");
  return { ...original, generateThreadTitle: jest.fn().mockResolvedValue({ changed: false }) };
});

const app = require("../app");

describe("Quota atomicity", () => {
  let token;
  let userId;

  beforeAll(async () => {
    const name = `quota_${Date.now().toString(36)}`;
    await request(app).post("/api/auth/register").send({ name, password: "testpass123" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    token = login.body.data.token;
    userId = login.body.data.user.id;
  });

  it("allows exactly one of two concurrent chats at the last slot", async () => {
    const today = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { dailyChatCount: 49, dailyCountDate: today },
    });

    const results = await Promise.all([
      request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "Pesan paralel pertama" }),
      request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "Pesan paralel kedua" }),
    ]);

    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 429]);

    const status = await getQuotaStatus(userId);
    expect(status.used).toBe(50);
    expect(status.remaining).toBe(0);

    const limited = results.find((res) => res.status === 429);
    expect(limited.body.message).toMatch(/Batas harian AI tercapai \(50\/50\)/);
  });

  it("refunds quota when the pipeline fails before responding", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyChatCount: 10, dailyCountDate: new Date() },
    });

    const response = require("../app/services/response");
    response.generateResponse.mockRejectedValueOnce(new Error("provider down"));

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Pesan yang gagal" });

    expect(res.status).toBe(500);

    const status = await getQuotaStatus(userId);
    expect(status.used).toBe(10);
  });

  it("charges quota for playground simulations", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyChatCount: 5, dailyCountDate: new Date() },
    });

    const res = await request(app)
      .post("/api/chat/playground")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Skenario playground" });

    expect(res.status).toBe(200);
    const status = await getQuotaStatus(userId);
    expect(status.used).toBe(6);
  });
});
