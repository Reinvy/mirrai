"use strict";

const { prisma } = require("../../config/db");
const { getLlmForUser } = require("../../services/llm-resolver");
const { withQuotaForUser } = require("../../services/quota");
const { parseLlmJson } = require("../../llm/json");
const { getPersonality } = require("../personality/personality-service");
const { retrieveMemory } = require("../memory/memory-service");
const { logger } = require("../../config/logger");
const { AppError } = require("../../utils/app-error");

const RISK_LEVELS = new Set(["Rendah", "Sedang", "Tinggi"]);
const BRANCH_COUNT = 3;

function invalidPayload() {
  return new AppError(502, "Respons simulasi tidak valid, coba lagi");
}

function asText(value, maxLen = 600) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}

function asScore(value, min = 0, max = 100) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return Math.round(num);
}

function normalizeBranches(raw) {
  if (!Array.isArray(raw) || raw.length !== BRANCH_COUNT) {
    throw invalidPayload();
  }
  return raw.map((item, index) => {
    if (!item || typeof item !== "object") throw invalidPayload();
    const name = asText(item.name, 120);
    const description = asText(item.description, 600);
    const probability = asScore(item.probability);
    const happinessForecast = asScore(item.happinessForecast);
    const riskLevel = RISK_LEVELS.has(item.riskLevel) ? item.riskLevel : null;
    const predictedEmotion = asText(item.predictedEmotion, 40);
    const counsel = item.counselReview;
    if (
      !name ||
      !description ||
      probability === null ||
      happinessForecast === null ||
      !riskLevel ||
      !predictedEmotion ||
      !counsel ||
      typeof counsel !== "object"
    ) {
      throw invalidPayload();
    }
    const rational = asText(counsel.rational, 600);
    const emotional = asText(counsel.emotional, 600);
    const futureSelf = asText(counsel.futureSelf, 600);
    if (!rational || !emotional || !futureSelf) throw invalidPayload();

    return {
      id: asText(item.id, 64) || `branch-${index + 1}`,
      name,
      description,
      probability,
      riskLevel,
      happinessForecast,
      predictedEmotion,
      counselReview: { rational, emotional, futureSelf },
    };
  });
}

function normalizeCouncil(raw) {
  if (!raw || typeof raw !== "object") throw invalidPayload();
  const consensus = asText(raw.consensus, 1000);
  const recommendedAction = asText(raw.recommendedAction, 1000);
  if (!consensus || !recommendedAction) throw invalidPayload();
  if (!Array.isArray(raw.transcripts) || raw.transcripts.length < 3 || raw.transcripts.length > 4) {
    throw invalidPayload();
  }
  const transcripts = raw.transcripts.map((item, index) => {
    if (!item || typeof item !== "object") throw invalidPayload();
    const speaker = asText(item.speaker, 80);
    const role = asText(item.role, 80);
    const message = asText(item.message, 1000);
    if (!speaker || !role || !message) throw invalidPayload();
    return {
      id: `turn-${index + 1}`,
      speaker,
      role,
      message,
      color: typeof item.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(item.color)
        ? item.color
        : "#6366f1",
    };
  });
  return { consensus, recommendedAction, transcripts };
}

async function callLlmForJson(llm, prompt, userId, label) {
  let text;
  try {
    const response = await llm.invoke(prompt);
    text =
      typeof response?.content === "string"
        ? response.content
        : Array.isArray(response?.content)
          ? response.content.map((c) => (typeof c === "string" ? c : c.text || "")).join("")
          : "";
  } catch (err) {
    logger.warn({ message: `${label} LLM call failed`, userId, error: err.message });
    throw new AppError(502, "Layanan simulasi gagal, coba lagi");
  }
  try {
    return parseLlmJson(text);
  } catch (err) {
    logger.warn({ message: `${label} JSON parse failed`, userId, error: err.message });
    throw invalidPayload();
  }
}

async function loadContext(userId, query, memoryLimit) {
  const [personality, memories] = await Promise.all([
    getPersonality(userId),
    retrieveMemory({ userId, query, limit: memoryLimit }).catch(() => []),
  ]);
  return { personality, memories };
}

/**
 * Generate branching life decision simulations, persisted as a session.
 */
async function simulateScenario({ userId, scenario, title }) {
  const { llm, byok } = await getLlmForUser(userId);
  const trimmed = scenario.trim();

  return withQuotaForUser(userId, byok, async () => {
    const { personality, memories } = await loadContext(userId, trimmed, 4);

    const prompt = `User menghadapi dilema / skenario hidup: "${trimmed}".
Personality traits: Empathy ${(personality.empathy * 100).toFixed(0)}%, Logic ${(personality.logic * 100).toFixed(0)}%, Confidence ${(personality.confidence * 100).toFixed(0)}%.
Memory relevan: ${memories.map((m) => m.content).join("; ") || "Belum ada"}.

Buat 3 cabang skenario masa depan (JSON array tepat 3 item) dengan struktur:
[
  {
    "id": "branch-1",
    "name": "Nama Jalur",
    "description": "Deskripsi singkat strategi",
    "probability": 75,
    "riskLevel": "Rendah|Sedang|Tinggi",
    "happinessForecast": 80,
    "predictedEmotion": "excited|happy|calm|anxious",
    "counselReview": {
      "rational": "Analisis sisi rasional",
      "emotional": "Analisis sisi emosional",
      "futureSelf": "Pesan dari diri 10 tahun ke depan"
    }
  }
]
HANYA RETURN JSON VALID TANPA MARKDOWN!`;

    const raw = await callLlmForJson(llm, prompt, userId, "Branch simulation");
    const branches = normalizeBranches(raw);

    return prisma.simulationSession.create({
      data: {
        userId,
        type: "branch",
        title: (title && title.trim()) || trimmed.slice(0, 50),
        scenario: trimmed,
        branches,
      },
    });
  });
}

/**
 * Conduct Council of Selves debate, persisted as a session.
 */
async function conductCouncilDebate({ userId, dilemma, title }) {
  const { llm, byok } = await getLlmForUser(userId);
  const trimmed = dilemma.trim();

  return withQuotaForUser(userId, byok, async () => {
    const { personality, memories } = await loadContext(userId, trimmed, 3);

    const prompt = `Dilema user: "${trimmed}".
Konteks personality: Empathy ${(personality.empathy * 100).toFixed(0)}%, Logic ${(personality.logic * 100).toFixed(0)}%, Humor ${(personality.humor * 100).toFixed(0)}%, Confidence ${(personality.confidence * 100).toFixed(0)}%, Playfulness ${(personality.playfulness * 100).toFixed(0)}%.
Memory relevan: ${memories.map((m) => m.content).join("; ") || "Belum ada"}.

Buat simulasi debat meja bundar antara 4 persona internal user:
1. "Rational Strategist" (Logika, efisiensi, probabilitas)
2. "Empathic Heart" (Perasaan, integritas emosional, hubungan)
3. "Shadow / Challenger" (Menantang ilusi & ketakutan tersembunyi)
4. "Future Self (10 Years)" (Sintesis kebijaksanaan jangka panjang)

Kembalikan format JSON:
{
  "consensus": "Kesimpulan bersama atau jalan tengah terbaik",
  "recommendedAction": "Langkah aksi konkret nomor 1 yang harus diambil",
  "transcripts": [
    { "speaker": "Rational Strategist", "role": "Logic Core", "message": "...", "color": "#6366f1" },
    { "speaker": "Empathic Heart", "role": "Emotional Intuition", "message": "...", "color": "#ec4899" },
    { "speaker": "Shadow Self", "role": "Bias Challenger", "message": "...", "color": "#f59e0b" },
    { "speaker": "Future Self", "role": "10-Yr Wisdom", "message": "...", "color": "#10b981" }
  ]
}
HANYA RETURN JSON VALID!`;

    const raw = await callLlmForJson(llm, prompt, userId, "Council debate");
    const { consensus, recommendedAction, transcripts } = normalizeCouncil(raw);

    return prisma.simulationSession.create({
      data: {
        userId,
        type: "council",
        title: (title && title.trim()) || trimmed.slice(0, 50),
        scenario: trimmed,
        branches: transcripts,
        consensus: { summary: consensus, recommendedAction },
      },
    });
  });
}

async function getUserSimulations(userId) {
  return prisma.simulationSession.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

async function getSimulationById(userId, id) {
  const session = await prisma.simulationSession.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!session) {
    throw new AppError(404, "Simulasi tidak ditemukan");
  }
  return session;
}

module.exports = {
  simulateScenario,
  conductCouncilDebate,
  getUserSimulations,
  getSimulationById,
};
