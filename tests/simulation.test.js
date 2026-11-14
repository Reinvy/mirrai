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

const VALID_BRANCHES = [
  {
    id: "branch-1",
    name: "Jalur Berani",
    description: "Mengambil langkah besar sekarang.",
    probability: 70,
    riskLevel: "Tinggi",
    happinessForecast: 85,
    predictedEmotion: "excited",
    counselReview: {
      rational: "Potensi upside tinggi.",
      emotional: "Adrenalin dan kepuasan.",
      futureSelf: "Kamu tidak akan menyesal mencoba.",
    },
  },
  {
    id: "branch-2",
    name: "Jalur Seimbang",
    description: "Bertahap sambil menjaga stabilitas.",
    probability: 85,
    riskLevel: "Sedang",
    happinessForecast: 80,
    predictedEmotion: "calm",
    counselReview: {
      rational: "Risk-adjusted return terbaik.",
      emotional: "Stres lebih rendah.",
      futureSelf: "Pilihan yang matang.",
    },
  },
  {
    id: "branch-3",
    name: "Jalur Konservatif",
    description: "Mempertahankan kondisi sekarang.",
    probability: 95,
    riskLevel: "Rendah",
    happinessForecast: 68,
    predictedEmotion: "neutral",
    counselReview: {
      rational: "Risiko minimal.",
      emotional: "Rasa aman tinggi.",
      futureSelf: "Aman namun ada peluang hilang.",
    },
  },
];

const VALID_COUNCIL = {
  consensus: "Ambil langkah bertahap dengan evaluasi bulanan.",
  recommendedAction: "Mulai uji coba 30 hari.",
  transcripts: [
    { speaker: "Rational Strategist", role: "Logic Core", message: "Hitung risiko.", color: "#6366f1" },
    { speaker: "Empathic Heart", role: "Emotional Intuition", message: "Ikuti nilai.", color: "#ec4899" },
    { speaker: "Shadow Self", role: "Bias Challenger", message: "Uji asumsi.", color: "#f59e0b" },
  ],
};

describe("Simulation", () => {
  let token;
  let userId;

  beforeAll(async () => {
    const name = `sim_${Date.now().toString(36)}`;
    await request(app).post("/api/auth/register").send({ name, password: "testpass123" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    token = login.body.data.token;
    userId = login.body.data.user.id;
  });

  it("rejects a scenario that is too short", async () => {
    const res = await request(app)
      .post("/api/simulation/branch")
      .set("Authorization", `Bearer ${token}`)
      .send({ scenario: "pendek" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed model payload and stores nothing", async () => {
    llmResolver.__setLlmImpl(async () => ({ content: "not json at all" }));

    const res = await request(app)
      .post("/api/simulation/branch")
      .set("Authorization", `Bearer ${token}`)
      .send({ scenario: "Haruskah saya pindah kota tahun depan?" });

    expect(res.status).toBe(502);
    expect(await prisma.simulationSession.count({ where: { userId } })).toBe(0);
  });

  it("persists a branch simulation with three branches", async () => {
    llmResolver.__setLlmImpl(async () => ({ content: JSON.stringify(VALID_BRANCHES) }));

    const res = await request(app)
      .post("/api/simulation/branch")
      .set("Authorization", `Bearer ${token}`)
      .send({ scenario: "Haruskah saya mengambil beasiswa luar negeri?" });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe("branch");
    expect(res.body.data.branches).toHaveLength(3);
    expect(res.body.data.id).toBeDefined();

    const stored = await prisma.simulationSession.findUnique({
      where: { id: res.body.data.id },
    });
    expect(stored.type).toBe("branch");
    expect(Array.isArray(stored.branches)).toBe(true);
  });

  it("persists a council debate with consensus", async () => {
    llmResolver.__setLlmImpl(async () => ({ content: JSON.stringify(VALID_COUNCIL) }));

    const res = await request(app)
      .post("/api/simulation/council")
      .set("Authorization", `Bearer ${token}`)
      .send({ dilemma: "Apakah saya harus berhenti dari pekerjaan sekarang?" });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe("council");
    expect(res.body.data.consensus).toMatchObject({
      summary: VALID_COUNCIL.consensus,
      recommendedAction: VALID_COUNCIL.recommendedAction,
    });
    expect(res.body.data.branches).toHaveLength(3);

    const stored = await prisma.simulationSession.findUnique({
      where: { id: res.body.data.id },
    });
    expect(stored.type).toBe("council");
    expect(stored.consensus).not.toBeNull();
  });

  it("lists stored simulations for the owner only", async () => {
    const list = await request(app)
      .get("/api/simulation")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);

    const otherName = `sim_other_${Date.now().toString(36)}`;
    await request(app)
      .post("/api/auth/register")
      .send({ name: otherName, password: "testpass123" });
    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({ name: otherName, password: "testpass123" });
    const otherToken = otherLogin.body.data.token;

    const targetId = list.body.data[0].id;
    const forbidden = await request(app)
      .get(`/api/simulation/${targetId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(404);

    const allowed = await request(app)
      .get(`/api/simulation/${targetId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.id).toBe(targetId);
  });
});
