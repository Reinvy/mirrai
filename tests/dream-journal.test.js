"use strict";

require("./setup");

const request = require("supertest");
const { prisma } = require("../app/config/db");

jest.mock("../app/services/llm-resolver", () => {
  const actual = jest.requireActual("../app/services/llm-resolver");
  const state = { impl: async () => ({ content: "" }) };
  return {
    ...actual,
    getLlmForUser: jest.fn(async () => ({
      llm: {
        invoke: (...args) => state.impl(...args),
      },
      byok: true,
      thinkingEnabled: false,
      visionEnabled: false,
    })),
    __setLlmImpl: (fn) => {
      state.impl = fn;
    },
  };
});

const app = require("../app");
const llmResolver = require("../app/services/llm-resolver");

describe("Dream journal", () => {
  let token;
  let userId;

  beforeAll(async () => {
    const name = `dream_${Date.now().toString(36)}`;
    await request(app).post("/api/auth/register").send({ name, password: "testpass123" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    token = login.body.data.token;
    userId = login.body.data.user.id;
  });

  it("rejects consolidation with fewer than two new memories", async () => {
    await prisma.memory.create({
      data: { userId, content: "Satu memori pendek", type: "SHORT_TERM" },
    });

    const res = await request(app)
      .post("/api/dream/consolidate")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Belum cukup memori/i);
    const entries = await prisma.dreamEntry.count({ where: { userId } });
    expect(entries).toBe(0);
  });

  it("stores a consolidated entry and marks the source memories", async () => {
    await prisma.memory.create({
      data: { userId, content: "Memori pendek kedua", type: "SHORT_TERM" },
    });

    llmResolver.__setLlmImpl(async () => ({
      content: JSON.stringify({
        theme: "Fokus & Konsistensi",
        reflection: "Pola interaksi menunjukkan fokus yang menguat.",
        coreBeliefs: [
          {
            content: "User menghargai konsistensi latihan harian.",
            category: "CORE_BELIEF",
            importance: 0.86,
          },
        ],
      }),
    }));

    const res = await request(app)
      .post("/api/dream/consolidate")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      theme: "Fokus & Konsistensi",
      consolidatedCount: 2,
    });
    expect(res.body.data.coreBeliefs).toHaveLength(1);

    const entry = await prisma.dreamEntry.findFirst({
      where: { userId, deletedAt: null },
    });
    expect(entry).not.toBeNull();
    expect(entry.theme).toBe("Fokus & Konsistensi");

    const unconsolidated = await prisma.memory.count({
      where: { userId, type: "SHORT_TERM", consolidatedAt: null },
    });
    expect(unconsolidated).toBe(0);

    const belief = await prisma.memory.findFirst({
      where: { userId, type: "SEMANTIC", category: "CORE_BELIEF" },
    });
    expect(belief).not.toBeNull();

    const journal = await request(app)
      .get("/api/dream/journal")
      .set("Authorization", `Bearer ${token}`);
    expect(journal.status).toBe(200);
    expect(journal.body.data).toHaveLength(1);
    expect(journal.body.data[0].theme).toBe("Fokus & Konsistensi");
  });

  it("returns 502 and stores nothing when the model payload is invalid", async () => {
    await prisma.memory.createMany({
      data: [
        { userId, content: "Memori pendek ketiga", type: "SHORT_TERM" },
        { userId, content: "Memori pendek keempat", type: "SHORT_TERM" },
      ],
    });

    const entriesBefore = await prisma.dreamEntry.count({ where: { userId } });
    const beliefsBefore = await prisma.memory.count({
      where: { userId, type: "SEMANTIC" },
    });

    llmResolver.__setLlmImpl(async () => ({
      content: "Maaf, saya tidak bisa memproses itu.",
    }));

    const res = await request(app)
      .post("/api/dream/consolidate")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(await prisma.dreamEntry.count({ where: { userId } })).toBe(entriesBefore);
    expect(await prisma.memory.count({ where: { userId, type: "SEMANTIC" } })).toBe(
      beliefsBefore,
    );

    const stillPending = await prisma.memory.count({
      where: { userId, type: "SHORT_TERM", consolidatedAt: null },
    });
    expect(stillPending).toBeGreaterThanOrEqual(2);
  });

  it("returns one deterministic resonance per local day", async () => {
    const first = await request(app)
      .get("/api/dream/daily-resonance")
      .set("Authorization", `Bearer ${token}`);
    const second = await request(app)
      .get("/api/dream/daily-resonance")
      .set("Authorization", `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.id).toBe(second.body.data.id);
    expect(first.body.data.theme).toBe(second.body.data.theme);

    const rows = await prisma.dailyResonance.count({ where: { userId } });
    expect(rows).toBe(1);
  });
});
