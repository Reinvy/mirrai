"use strict";

require("./setup");

const request = require("supertest");

// Mock AI services to avoid OpenRouter calls
jest.mock("../app/services/emotion", () => ({
  detectEmotion: jest.fn().mockResolvedValue({ emotion: "neutral", confidence: 0.8 }),
}));
jest.mock("../app/services/thought", () => ({
  generateThought: jest.fn().mockResolvedValue("Memikirkan respons..."),
}));
jest.mock("../app/services/decision", () => {
  const defaultText = "Respons test.";
  async function* defaultGen() {
    for (const w of defaultText.split(" ")) yield w + " ";
  }
  const state = { impl: defaultGen };
  function streamDecision() {
    return state.impl();
  }
  streamDecision.__setImpl = (fn) => {
    state.impl = fn;
  };
  streamDecision.__resetImpl = () => {
    state.impl = defaultGen;
  };
  return {
    generateDecision: jest.fn().mockResolvedValue(defaultText),
    streamDecision,
  };
});
jest.mock("../app/services/evolution", () => ({
  evolvePersonality: jest.fn().mockResolvedValue({}),
}));

// Mock the LLM extraction chain only. The real memory-extraction service
// still runs, so its normalization (validate type, clamp score, dedupe,
// cap at 3) is exercised end-to-end. A stateful closure is used because
// `jest.mock` is hoisted and cannot reference outer scope.
jest.mock("../app/llm/chains/memory-extraction-chain", () => {
  const state = { impl: async () => ({ memories: [] }) };
  return {
    memoryExtractionChain: {
      invoke: async (...args) => {
        try {
          return await state.impl(...args);
        } catch {
          return { memories: [] };
        }
      },
    },
    __setImpl: (fn) => {
      state.impl = fn;
    },
    __reset: () => {
      state.impl = async () => ({ memories: [] });
    },
  };
});

const chainMock = require("../app/llm/chains/memory-extraction-chain");
const setExtractionChain = (impl) => chainMock.__setImpl(impl);
const resetExtractionChain = () => chainMock.__reset();

const { prisma } = require("../app/config/db");
const app = require("../app");

describe("Memory extraction in chat pipeline", () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const name = `memextractuser_${Date.now()}`;
    await request(app).post("/api/auth/register").send({ name, password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    authToken = loginRes.body.data.token;
    userId = loginRes.body.data.user.id;
  });

  afterAll(async () => {
    resetExtractionChain();
    await prisma.memory.deleteMany({ where: { userId } });
  });

  afterEach(async () => {
    resetExtractionChain();
    // Each test asserts counts of freshly created memories; previous-test
    // rows would skew those counts. The chat test creates a thread per call
    // (new user, no threadId supplied), but memory rows are global per user.
    await prisma.memory.deleteMany({ where: { userId } });
  });

  const listMemoriesByType = async () => {
    const rows = await prisma.memory.findMany({
      where: { userId, deletedAt: null },
      select: { type: true, content: true, importanceScore: true },
    });
    const byType = { SHORT_TERM: [], LONG_TERM: [], SEMANTIC: [], EMOTIONAL: [] };
    for (const r of rows) {
      byType[r.type] = byType[r.type] || [];
      byType[r.type].push(r);
    }
    return { rows, byType };
  };

  it("extracts SEMANTIC + LONG_TERM + EMOTIONAL facts alongside SHORT_TERM", async () => {
    setExtractionChain(async () => ({
      memories: [
        { content: "Suka kopi hitam tanpa gula", type: "SEMANTIC", importanceScore: 0.7 },
        { content: "Bekerja sebagai software engineer", type: "LONG_TERM", importanceScore: 0.85 },
        {
          content: "Merasa cemas berat tentang deadline bulan depan",
          type: "EMOTIONAL",
          importanceScore: 0.9,
        },
      ],
    }));

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        message: "Aku kerja sebagai software engineer dan lagi cemas berat soal deadline.",
      });

    expect(res.status).toBe(200);
    const { byType } = await listMemoriesByType();
    expect(byType.SHORT_TERM.length).toBeGreaterThanOrEqual(1);
    expect(byType.SEMANTIC).toHaveLength(1);
    expect(byType.LONG_TERM).toHaveLength(1);
    expect(byType.EMOTIONAL).toHaveLength(1);
    expect(byType.SEMANTIC[0].content).toBe("Suka kopi hitam tanpa gula");
    expect(byType.LONG_TERM[0].importanceScore).toBeCloseTo(0.85);
    expect(byType.EMOTIONAL[0].importanceScore).toBeCloseTo(0.9);
  });

  it("falls back to SHORT_TERM only when extraction returns empty array", async () => {
    setExtractionChain(async () => ({ memories: [] }));
    const before = (await listMemoriesByType()).rows.length;

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Halo apa kabar?" });

    expect(res.status).toBe(200);
    const { rows, byType } = await listMemoriesByType();
    expect(rows.length).toBe(before + 1);
    expect(rows[rows.length - 1].type).toBe("SHORT_TERM");
    expect(byType.SEMANTIC.length + byType.LONG_TERM.length + byType.EMOTIONAL.length).toBe(0);
  });

  it("does not crash chat when extraction throws (fallback to SHORT_TERM)", async () => {
    setExtractionChain(async () => {
      throw new Error("LLM down");
    });
    const before = (await listMemoriesByType()).rows.length;

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Pesan yang akan tetap diproses." });

    expect(res.status).toBe(200);
    const { rows, byType } = await listMemoriesByType();
    expect(rows.length).toBe(before + 1);
    expect(rows[rows.length - 1].type).toBe("SHORT_TERM");
    expect(byType.SEMANTIC.length + byType.LONG_TERM.length + byType.EMOTIONAL.length).toBe(0);
  });

  it("rejects invalid types from LLM (only valid MemoryType persisted)", async () => {
    setExtractionChain(async () => ({
      memories: [
        { content: "Fakta valid", type: "SEMANTIC", importanceScore: 0.6 },
        { content: "Tipe ngaco", type: "BLAHBLAH", importanceScore: 0.6 },
        { content: "", type: "EMOTIONAL", importanceScore: 0.9 },
        { content: "Score aneh", type: "LONG_TERM", importanceScore: 5 },
      ],
    }));

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "Campur fakta valid dan invalid." });

    expect(res.status).toBe(200);
    const { rows, byType } = await listMemoriesByType();
    const lastFour = rows.slice(-4);
    const lastShort = lastFour.find((r) => r.type === "SHORT_TERM");
    const lastSemantic = lastFour.find((r) => r.type === "SEMANTIC");
    expect(lastShort).toBeDefined();
    expect(lastSemantic.content).toBe("Fakta valid");
    // Invalid type filtered
    expect(byType.SEMANTIC.length).toBe(1);
    // Score 5 clamped to 1.0 and the item is now valid LONG_TERM
    const longTerm = byType.LONG_TERM.find((r) => r.content === "Score aneh");
    expect(longTerm).toBeDefined();
    expect(longTerm.importanceScore).toBe(1.0);
  });
});
