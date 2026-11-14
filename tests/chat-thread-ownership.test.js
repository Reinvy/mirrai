"use strict";

require("./setup");

const request = require("supertest");
const { prisma } = require("../app/config/db");

jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest.fn().mockResolvedValue({ emotion: "neutral", confidence: 0.8 }),
}));
jest.mock("../app/services/memory-extraction", () => ({
  extractMemories: jest.fn().mockResolvedValue([]),
}));
jest.mock("../app/services/response", () => ({
  generateResponse: jest
    .fn()
    .mockResolvedValue({ text: "Respons test.", reasoning: null }),
  streamResponse: async function* empty() {},
}));
jest.mock("../app/services/evolution", () => ({
  evolvePersonality: jest.fn().mockResolvedValue({}),
}));

const app = require("../app");

describe("Chat thread ownership", () => {
  let tokenA;
  let userIdA;
  let userBThreadId;
  let userAThreadId;
  let userBOriginalTitle;

  beforeAll(async () => {
    const nameA = `owner_a_${Date.now().toString(36)}`;
    const nameB = `owner_b_${Date.now().toString(36)}`;
    await request(app).post("/api/auth/register").send({ name: nameA, password: "testpass123" });
    await request(app).post("/api/auth/register").send({ name: nameB, password: "testpass123" });

    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ name: nameA, password: "testpass123" });
    tokenA = loginA.body.data.token;
    userIdA = loginA.body.data.user.id;

    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ name: nameB, password: "testpass123" });
    const tokenB = loginB.body.data.token;

    const threadB = await request(app)
      .post("/api/chat/threads")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Thread milik B" });
    userBThreadId = threadB.body.data.id;
    userBOriginalTitle = threadB.body.data.title;

    const threadA = await request(app)
      .post("/api/chat/threads")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "Thread milik A" });
    userAThreadId = threadA.body.data.id;
  });

  it("rejects writing into another user's thread", async () => {
    const before = await prisma.conversation.count({ where: { threadId: userBThreadId } });

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ message: "Halo, aku menyusup", threadId: userBThreadId });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Thread tidak ditemukan/i);

    const after = await prisma.conversation.count({ where: { threadId: userBThreadId } });
    expect(after).toBe(before);

    const thread = await prisma.thread.findUnique({ where: { id: userBThreadId } });
    expect(thread.title).toBe(userBOriginalTitle);
  });

  it("rejects streaming into another user's thread as JSON, not SSE", async () => {
    const res = await request(app)
      .post("/api/chat/stream")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ message: "Halo streaming menyusup", threadId: userBThreadId });

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.message).toMatch(/Thread tidak ditemukan/i);
  });

  it("rejects an invalid threadId payload", async () => {
    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ message: "test", threadId: "   " });
    expect(res.status).toBe(400);
  });

  it("writes into the caller's own thread", async () => {
    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ message: "Halo thread sendiri", threadId: userAThreadId });

    expect(res.status).toBe(200);
    expect(res.body.data.threadId).toBe(userAThreadId);

    const stored = await prisma.conversation.findFirst({
      where: { userId: userIdA, threadId: userAThreadId, deletedAt: null },
    });
    expect(stored).not.toBeNull();
  });
});
