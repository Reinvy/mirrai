"use strict";

require("./setup");

const request = require("supertest");
const { prisma } = require("../app/config/db");

// Mock the AI chain calls to avoid OpenRouter dependency in tests
jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest.fn().mockResolvedValue({ emotion: "neutral", confidence: 0.8 }),
}));
jest.mock("../app/services/response", () => ({
  generateResponse: jest
    .fn()
    .mockResolvedValue({ text: "Ini adalah respons test dari MirrAI.", reasoning: null }),
}));
jest.mock("../app/services/evolution", () => ({
  evolvePersonality: jest.fn().mockResolvedValue({}),
}));

// Mock the background thread title generator to update the title directly in the DB
jest.mock("../app/modules/chat/thread-service", () => {
  const originalModule = jest.requireActual("../app/modules/chat/thread-service");
  return {
    ...originalModule,
    generateThreadTitle: jest.fn().mockImplementation(async (threadId, userId) => {
      const { prisma } = require("../app/config/db");
      await prisma.thread.update({
        where: { id: threadId },
        data: { title: "Topik Percakapan Otomatis" },
      });
    }),
  };
});

const app = require("../app");

describe("Chat Threads API", () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const name = `threaduser_${Date.now()}`;
    await request(app).post("/api/auth/register").send({ name, password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    authToken = loginRes.body.data.token;

    // Retrieve userId from database based on unique name
    const user = await prisma.user.findUnique({
      where: { name },
    });
    userId = user.id;
  });

  describe("GET /api/chat/threads", () => {
    it("should return empty list initially", async () => {
      const res = await request(app)
        .get("/api/chat/threads")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe("POST /api/chat/threads", () => {
    it("should create a new thread", async () => {
      const res = await request(app)
        .post("/api/chat/threads")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Diskusi Desain" });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.title).toBe("Diskusi Desain");
      expect(res.body.data.userId).toBe(userId);
    });
  });

  describe("PUT /api/chat/threads/:threadId", () => {
    it("should update the title of a thread", async () => {
      const createRes = await request(app)
        .post("/api/chat/threads")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Judul Lama" });
      const threadId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/chat/threads/${threadId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Judul Baru" });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Judul Baru");
    });

    it("should reject update if title is empty", async () => {
      const createRes = await request(app)
        .post("/api/chat/threads")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Thread Penting" });
      const threadId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/chat/threads/${threadId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "" });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/chat/threads/:threadId", () => {
    it("should soft delete the thread and its conversations", async () => {
      // 1. Create a thread
      const createRes = await request(app)
        .post("/api/chat/threads")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Thread Hapus" });
      const threadId = createRes.body.data.id;

      // 2. Add a conversation in it
      await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "Pesan test", threadId });

      // Verify conversation exists in DB
      let conversations = await prisma.conversation.findMany({
        where: { threadId, deletedAt: null },
      });
      expect(conversations.length).toBe(1);

      // 3. Delete the thread
      const res = await request(app)
        .delete(`/api/chat/threads/${threadId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      // Verify thread is soft-deleted
      const threadInDb = await prisma.thread.findUnique({
        where: { id: threadId },
      });
      expect(threadInDb.deletedAt).not.toBeNull();

      // Verify conversations in thread are soft-deleted
      conversations = await prisma.conversation.findMany({
        where: { threadId, deletedAt: null },
      });
      expect(conversations.length).toBe(0);
    });
  });

  describe("Chat Integration with Threads", () => {
    it("should automatically create a thread when sending chat without threadId", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "Percakapan pertama otomatis" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("threadId");

      const generatedThreadId = res.body.data.threadId;

      // Check that the thread exists in the database
      const thread = await prisma.thread.findUnique({
        where: { id: generatedThreadId },
      });
      expect(thread).toBeDefined();
      expect(thread.userId).toBe(userId);

      // Wait a tiny bit for the async mock generateThreadTitle to execute
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedThread = await prisma.thread.findUnique({
        where: { id: generatedThreadId },
      });
      expect(updatedThread.title).toBe("Topik Percakapan Otomatis");
    });

    it("should retrieve chat history filtered by threadId", async () => {
      // 1. Create two threads
      const thread1Res = await request(app)
        .post("/api/chat/threads")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Thread 1" });
      const thread2Res = await request(app)
        .post("/api/chat/threads")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Thread 2" });

      const thread1Id = thread1Res.body.data.id;
      const thread2Id = thread2Res.body.data.id;

      // 2. Send messages to each thread
      await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "Halo Thread 1", threadId: thread1Id });

      await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ message: "Halo Thread 2", threadId: thread2Id });

      // 3. Retrieve history for thread 1
      const hist1Res = await request(app)
        .get(`/api/chat?threadId=${thread1Id}`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(hist1Res.status).toBe(200);
      expect(hist1Res.body.data.length).toBe(1);
      expect(hist1Res.body.data[0].message).toBe("Halo Thread 1");

      // 4. Retrieve history for thread 2
      const hist2Res = await request(app)
        .get(`/api/chat?threadId=${thread2Id}`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(hist2Res.status).toBe(200);
      expect(hist2Res.body.data.length).toBe(1);
      expect(hist2Res.body.data[0].message).toBe("Halo Thread 2");
    });
  });
});
