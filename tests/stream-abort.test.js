"use strict";

require("./setup");

const { prisma } = require("../app/config/db");

// The generator under test is driven directly, so the chat pipeline only needs
// a ready-made "prepared" context and a controllable token stream.
jest.mock("../app/services/memory-extraction", () => ({
  extractMemories: jest.fn().mockResolvedValue([]),
}));
jest.mock("../app/services/evolution", () => ({
  evolvePersonality: jest.fn().mockResolvedValue({}),
}));
jest.mock("../app/services/response", () => ({
  generateResponse: jest.fn(),
  streamResponse: jest.fn(),
}));
jest.mock("../app/modules/chat/thread-service", () => {
  const actual = jest.requireActual("../app/modules/chat/thread-service");
  return { ...actual, generateThreadTitle: jest.fn().mockResolvedValue({ changed: false }) };
});

const { streamPreparedChat } = require("../app/modules/chat/chat-stream-service");
const response = require("../app/services/response");

function buildPrep(overrides = {}) {
  return {
    userId: null,
    threadId: null,
    createdThread: false,
    llm: {},
    byok: false,
    quotaCharged: false,
    emotion: { emotion: "neutral", confidence: 0.8 },
    memories: [],
    personality: null,
    profile: { name: "Tester", bio: null },
    threadContext: [],
    personalityTrend: "",
    message: "Pesan yang dihentikan di tengah jalan",
    attachments: [],
    persona: "twin",
    ...overrides,
  };
}

describe("Stream abort persistence", () => {
  let userId;
  let threadId;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: `stream_abort_${Date.now().toString(36)}`,
        password: "x",
      },
      select: { id: true },
    });
    userId = user.id;

    const thread = await prisma.thread.create({
      data: { userId, title: "Thread abort" },
      select: { id: true },
    });
    threadId = thread.id;
  });

  afterAll(async () => {
    await prisma.conversation.deleteMany({ where: { userId } });
    await prisma.memory.deleteMany({ where: { userId } });
    await prisma.thread.deleteMany({ where: { userId } });
    await prisma.personality.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("persists a partial conversation when the client stops the stream", async () => {
    response.streamResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Bagian pertama. " };
      yield { type: "delta", text: "Bagian kedua." };
      // Would keep going forever; .return() from the caller ends it.
      await new Promise(() => {});
    });

    const prep = buildPrep({ userId, threadId });
    const gen = streamPreparedChat(prep, { signal: new AbortController().signal });

    const first = await gen.next(); // meta
    const second = await gen.next(); // delta 1
    const third = await gen.next(); // delta 2
    expect(JSON.parse(first.value).event).toBe("meta");
    expect(JSON.parse(second.value).text).toBe("Bagian pertama. ");
    expect(JSON.parse(third.value).text).toBe("Bagian kedua.");

    await gen.return(undefined);

    const stored = await prisma.conversation.findFirst({
      where: { userId, threadId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(stored).not.toBeNull();
    expect(stored.partial).toBe(true);
    expect(stored.response).toContain("Bagian pertama.");
    expect(stored.response).toContain("Bagian kedua.");
    expect(stored.persona).toBe("twin");
  });

  it("persists no row when the abort happens before any token arrived", async () => {
    response.streamResponse.mockImplementation(async function* () {
      await new Promise(() => {});
    });

    const prep = buildPrep({
      userId,
      threadId: null,
      createdThread: true,
      quotaCharged: false,
    });
    // Give the generator a real thread to clean up.
    const thread = await prisma.thread.create({
      data: { userId, title: "Thread kosong" },
      select: { id: true },
    });
    prep.threadId = thread.id;

    const gen = streamPreparedChat(prep, { signal: new AbortController().signal });
    await gen.next();
    await gen.return(undefined);

    const conversations = await prisma.conversation.count({ where: { threadId: thread.id } });
    expect(conversations).toBe(0);

    const cleaned = await prisma.thread.findUnique({ where: { id: thread.id } });
    expect(cleaned.deletedAt).not.toBeNull();
  });
});
