"use strict";

require("./setup");

const request = require("supertest");
const { prisma } = require("../app/config/db");
const app = require("../app");

jest.mock("../app/config/openai", () => {
  const { Runnable } = require("@langchain/core/runnables");
  const { AIMessageChunk } = require("@langchain/core/messages");

  let callCount = 0;

  class FakeLlm extends Runnable {
    lc_namespace = ["fake"];

    async invoke() {
      callCount += 1;
      const text = callCount % 2 === 1 ? "Judul Awal" : "Judul Regen";
      return new AIMessageChunk(text);
    }
  }

  return { getLlm: () => new FakeLlm() };
});

const { generateThreadTitle } = require("../app/modules/chat/thread-service");

async function createUserAndThread(prefix) {
  const name = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  await request(app).post("/api/auth/register").send({ name, password: "testpass123" });
  const user = await prisma.user.findUnique({ where: { name } });
  const thread = await prisma.thread.create({
    data: { userId: user.id, title: "Initial" },
  });
  return { userId: user.id, threadId: thread.id };
}

async function addConversation(userId, threadId, message) {
  return prisma.conversation.create({
    data: {
      userId,
      threadId,
      message,
      response: `response to ${message}`,
      emotion: { emotion: "neutral", confidence: 0.5 },
    },
  });
}

describe("generateThreadTitle conversation count rules", () => {
  it("generates title at conversationCount 1", async () => {
    const { userId, threadId } = await createUserAndThread("count_1");
    await addConversation(userId, threadId, "alpha content");
    const r = await generateThreadTitle(threadId, userId, { conversationCount: 1 });
    expect(r.changed).toBe(true);
    expect(r.title).toBe("Judul Awal");
    const t = await prisma.thread.findUnique({ where: { id: threadId } });
    expect(t.title).toBe("Judul Awal");
  });

  it("does not regenerate at conversationCount 2", async () => {
    const { userId, threadId } = await createUserAndThread("count_2");
    await addConversation(userId, threadId, "first");
    const r1 = await generateThreadTitle(threadId, userId, { conversationCount: 1 });
    expect(r1.changed).toBe(true);
    await addConversation(userId, threadId, "second");
    const r2 = await generateThreadTitle(threadId, userId, { conversationCount: 2 });
    expect(r2.changed).toBe(false);
  });

  it("regenerates title at conversationCount 3", async () => {
    const { userId, threadId } = await createUserAndThread("count_3");
    await addConversation(userId, threadId, "first");
    const r1 = await generateThreadTitle(threadId, userId, { conversationCount: 1 });
    expect(r1.changed).toBe(true);
    await addConversation(userId, threadId, "second");
    await addConversation(userId, threadId, "third");
    const r3 = await generateThreadTitle(threadId, userId, { conversationCount: 3 });
    expect(r3.changed).toBe(true);
    expect(r3.title).toBe("Judul Regen");
  });

  it("does not regenerate at conversationCount 4 or 5", async () => {
    const { userId, threadId } = await createUserAndThread("count_45");
    await addConversation(userId, threadId, "first");
    await generateThreadTitle(threadId, userId, { conversationCount: 1 });
    for (const m of ["b", "c", "d", "e"]) {
      await addConversation(userId, threadId, m);
    }
    const r4 = await generateThreadTitle(threadId, userId, { conversationCount: 4 });
    expect(r4.changed).toBe(false);
    const r5 = await generateThreadTitle(threadId, userId, { conversationCount: 5 });
    expect(r5.changed).toBe(false);
  });

  it("returns changed:false when no conversations exist", async () => {
    const { userId, threadId } = await createUserAndThread("empty");
    const r = await generateThreadTitle(threadId, userId, { conversationCount: 1 });
    expect(r.changed).toBe(false);
  });
});
