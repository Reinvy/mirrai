"use strict";

const { prisma } = require("../../config/db");
const { getLlm } = require("../../config/openai");
const { getLlmForUser } = require("../../services/llm-resolver");
const { getPersonality } = require("../personality/personality-service");
const { logger } = require("../../config/logger");

/**
 * Consolidate recent short-term memories into core beliefs and insights
 */
async function consolidateMemories({ userId }) {
  const shortTerms = await prisma.memory.findMany({
    where: { userId, type: "SHORT_TERM", deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 15,
  }).catch(() => []);

  if (shortTerms.length < 2) {
    return {
      message: "Belum cukup memori baru untuk konsolidasi",
      consolidatedCount: shortTerms.length,
      insights: [],
    };
  }

  const memoryTexts = shortTerms.map((m) => `- ${m.content}`).join("\n");
  let distilledInsights = [];

  try {
    const userLlm = await getLlmForUser(userId).catch(() => ({ llm: getLlm() }));
    const llm = userLlm.llm || getLlm();

    const prompt = `Berikut adalah beberapa interaksi/memori jangka pendek terbaru dari user:
${memoryTexts}

Lakukan proses "Subconscious Memory Consolidation" (seperti siklus tidur REM pada otak manusia):
1. Temukan 1-2 pola pikir, preferensi konsisten, atau keyakinan inti (Core Belief) yang tersirat.
2. Formulasikan sintesis memori permanen.

Kembalikan format JSON:
{
  "theme": "Tema Konsolidasi (misal: Ambisi Kreatif & Keseimbangan)",
  "coreBeliefs": [
    { "content": "Pernyataan keyakinan / fakta permanen", "category": "CORE_BELIEF", "importance": 0.85 }
  ],
  "reflection": "Ringkasan reflektif mengenai perkembangan user akhir-akhir ini"
}
HANYA RETURN JSON VALID!`;

    const res = await llm.invoke(prompt);
    const cleanJson = (res?.content || "").replace(/```json/g, "").replace(/```/g, "").trim();
    distilledInsights = JSON.parse(cleanJson);
  } catch {
    distilledInsights = {
      theme: "Siklus Konsolidasi Kognitif",
      coreBeliefs: [
        {
          content: "User menghargai kejelasan arah dan refleksi berkala dalam mengambil keputusan penting.",
          category: "CORE_BELIEF",
          importance: 0.85,
        },
      ],
      reflection: "Pola interaksi terbaru menunjukkan pencarian keseimbangan antara efisiensi kerja dan ketenangan batin.",
    };
  }

  // Save synthesized memories as SEMANTIC / CORE_BELIEF
  if (distilledInsights.coreBeliefs && Array.isArray(distilledInsights.coreBeliefs)) {
    for (const b of distilledInsights.coreBeliefs) {
      await prisma.memory.create({
        data: {
          userId,
          content: b.content,
          category: b.category || "CORE_BELIEF",
          type: "SEMANTIC",
          importanceScore: b.importance || 0.8,
          emotionalValence: 0.2,
        },
      }).catch(() => null);
    }
  }

  return {
    theme: distilledInsights.theme,
    reflection: distilledInsights.reflection,
    consolidatedCount: shortTerms.length,
    newCoreBeliefs: distilledInsights.coreBeliefs,
  };
}

/**
 * Get or generate today's Daily Resonance (Morning Pulse)
 */
async function getDailyResonance(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let resonance = await prisma.dailyResonance.findFirst({
    where: {
      userId,
      date: { gte: today },
    },
  }).catch(() => null);

  if (!resonance) {
    const personality = await getPersonality(userId).catch(() => ({ empathy: 0.6, logic: 0.7 }));
    const recentMemories = await prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }).catch(() => []);

    const themes = [
      {
        theme: "Arsitektur Pikiran & Fokus",
        reflection: "Hari ini adalah kanvas bersih untuk menyelaraskan antara apa yang kamu inginkan dan tindakan nyata yang kamu ambil.",
        prompt: "Apa satu hal yang paling layak mendapatkan fokus dan energi terbaikmu hari ini?",
        moodAura: "#6366f1",
      },
      {
        theme: "Resonansi Emosi & Ketenangan",
        reflection: "Dalam kecepatan dunia yang serba instan, kemampuan untuk berhenti sejenak dan merasakan adalah kekuatan sejati.",
        prompt: "Bagaimana kondisimu saat ini—apakah pikiranmu sedang penuh, atau siap melangkah?",
        moodAura: "#ec4899",
      },
      {
        theme: "Eksplorasi & Keberanian Melangkah",
        reflection: "Setiap lompatan besar selalu dimulai dari keputusan kecil yang diambil dengan keyakinan penuh.",
        prompt: "Jika rasa takut gagal dihapus sepenuhnya, langkah apa yang ingin kamu mulai hari ini?",
        moodAura: "#f59e0b",
      },
    ];

    const pick = themes[Math.floor(Math.random() * themes.length)];

    resonance = await prisma.dailyResonance.create({
      data: {
        userId,
        theme: pick.theme,
        reflection: pick.reflection,
        prompt: pick.prompt,
        moodAura: pick.moodAura,
        read: false,
      },
    }).catch(() => ({
      id: `res-${Date.now()}`,
      userId,
      date: new Date(),
      theme: pick.theme,
      reflection: pick.reflection,
      prompt: pick.prompt,
      moodAura: pick.moodAura,
      read: false,
    }));
  }

  return resonance;
}

/**
 * Get dream journal entries
 */
async function getDreamJournal(userId) {
  return prisma.dailyResonance.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 30,
  }).catch(() => []);
}

module.exports = {
  consolidateMemories,
  getDailyResonance,
  getDreamJournal,
};
