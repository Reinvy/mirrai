"use strict";

const { prisma } = require("../config/db");
const { logger } = require("../config/logger");
const { savePersonalitySnapshot } = require("../modules/personality/personality-service");

const EMOTION_WEIGHTS = {
  sad: {
    empathy: 0.05,
    logic: -0.02,
    humor: -0.03,
    confidence: -0.03,
    playfulness: -0.03,
  },
  happy: {
    empathy: 0.02,
    logic: 0.01,
    humor: 0.05,
    confidence: 0.05,
    playfulness: 0.05,
  },
  angry: {
    empathy: -0.03,
    logic: 0.03,
    humor: -0.05,
    confidence: 0.03,
    playfulness: -0.03,
  },
  anxious: {
    empathy: 0.03,
    logic: 0.02,
    humor: -0.03,
    confidence: -0.05,
    playfulness: -0.02,
  },
  excited: {
    empathy: 0.03,
    logic: 0.01,
    humor: 0.04,
    confidence: 0.04,
    playfulness: 0.05,
  },
  confused: {
    empathy: 0.02,
    logic: -0.03,
    humor: -0.01,
    confidence: -0.03,
    playfulness: -0.01,
  },
  lonely: {
    empathy: 0.05,
    logic: -0.01,
    humor: -0.03,
    confidence: -0.04,
    playfulness: -0.02,
  },
  neutral: { empathy: 0, logic: 0, humor: 0, confidence: 0, playfulness: 0 },
};

const MEMORY_KEYWORDS = {
  logic: [
    "analisa",
    "analisis",
    "data",
    "sistem",
    "rancang",
    "struktur",
    "logika",
    "framework",
    "metode",
    "studi",
    "riset",
    "eksperimen",
    "hipotesis",
  ],
  humor: ["lucu", "humor", "canda", "ngakak", "receh", "joke", "lelucon", "kocak", "lawak", "meme"],
  empathy: [
    "merasa",
    "sedih",
    "senang",
    "bantu",
    "peduli",
    "empati",
    "support",
    "dukung",
    "kasihan",
    "tersentuh",
    "haru",
  ],
  confidence: [
    "yakin",
    "pasti",
    "tegas",
    "keputusan",
    "tujuan",
    "target",
    "komitmen",
    "berani",
    "optimis",
    "keyakinan",
  ],
  playfulness: [
    "main",
    "bermain",
    "game",
    "musik",
    "film",
    "hiburan",
    "santai",
    "refreshing",
    "hobi",
    "explore",
    "petualangan",
  ],
};

const MAX_MEMORY_DRIFT = 0.01;

function clamp(val, min = 0.1, max = 1.0) {
  return Math.min(Math.max(val, min), max);
}

function computeMemoryDrift(memories) {
  const drift = { empathy: 0, logic: 0, humor: 0, confidence: 0, playfulness: 0 };
  if (!Array.isArray(memories) || memories.length === 0) return drift;
  const counts = Object.fromEntries(Object.keys(MEMORY_KEYWORDS).map((k) => [k, 0]));
  for (const m of memories) {
    const text = String(m?.content || "").toLowerCase();
    if (!text) continue;
    const importance = typeof m.importanceScore === "number" ? m.importanceScore : 0.5;
    for (const [trait, keywords] of Object.entries(MEMORY_KEYWORDS)) {
      if (keywords.some((kw) => text.includes(kw))) {
        counts[trait] += importance;
      }
    }
  }
  const totalWeight = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return drift;
  const totalMem = Math.max(1, memories.length);
  for (const trait of Object.keys(MEMORY_KEYWORDS)) {
    const ratio = counts[trait] / totalMem;
    drift[trait] = clamp(ratio * MAX_MEMORY_DRIFT, -MAX_MEMORY_DRIFT, MAX_MEMORY_DRIFT);
  }
  return drift;
}

async function evolvePersonality({ userId, emotion }) {
  const personality = await prisma.personality.findUnique({
    where: { userId },
  });
  if (!personality) return null;

  const emotionWeights = EMOTION_WEIGHTS[emotion.emotion] ?? EMOTION_WEIGHTS.neutral;
  const factor = emotion.confidence ?? 0.5;

  const emotionDelta = {
    empathy: emotionWeights.empathy * factor,
    logic: emotionWeights.logic * factor,
    humor: emotionWeights.humor * factor,
    confidence: emotionWeights.confidence * factor,
    playfulness: emotionWeights.playfulness * factor,
  };

  const recentMemories = await prisma.memory.findMany({
    where: { userId, deletedAt: null, type: { in: ["LONG_TERM", "SEMANTIC"] } },
    orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: { content: true, importanceScore: true },
  });
  const memoryDelta = computeMemoryDrift(recentMemories);

  const updatedData = {
    empathy: clamp(personality.empathy + emotionDelta.empathy + memoryDelta.empathy),
    logic: clamp(personality.logic + emotionDelta.logic + memoryDelta.logic),
    humor: clamp(personality.humor + emotionDelta.humor + memoryDelta.humor),
    confidence: clamp(personality.confidence + emotionDelta.confidence + memoryDelta.confidence),
    playfulness: clamp(
      personality.playfulness + emotionDelta.playfulness + memoryDelta.playfulness,
    ),
  };

  logger.debug({
    message: "Evolving personality",
    userId,
    emotion: emotion.emotion,
    emotionDelta: Object.fromEntries(
      Object.entries(emotionDelta).map(([k, v]) => [k, +v.toFixed(4)]),
    ),
    memoryDelta: Object.fromEntries(
      Object.entries(memoryDelta).map(([k, v]) => [k, +v.toFixed(4)]),
    ),
    finalDiff: Object.fromEntries(
      Object.entries(updatedData).map(([k, v]) => [k, +(v - personality[k]).toFixed(4)]),
    ),
  });

  const updated = await prisma.personality.update({
    where: { userId },
    data: updatedData,
  });

  await savePersonalitySnapshot(userId, updated);

  const emotionalTypes = ["sad", "angry", "anxious", "lonely"];
  if (emotionalTypes.includes(emotion.emotion)) {
    await prisma.$executeRaw`
      UPDATE "Memory"
      SET "importanceScore" = LEAST("importanceScore" + 0.1, 1.0)
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        AND type = 'EMOTIONAL'::"MemoryType"
    `;
  }

  return updated;
}

module.exports = { evolvePersonality, computeMemoryDrift };
