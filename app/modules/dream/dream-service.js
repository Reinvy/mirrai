"use strict";

const { prisma } = require("../../config/db");
const { getLlmForUser } = require("../../services/llm-resolver");
const { withQuotaForUser } = require("../../services/quota");
const { parseLlmJson } = require("../../llm/json");
const { saveMemory } = require("../memory/memory-service");
const { startOfDay, localDateKey } = require("../../utils/date");
const { logger } = require("../../config/logger");
const { AppError } = require("../../utils/app-error");

const MAX_CORE_BELIEFS = 3;
const MAX_CONSOLIDATION_BATCH = 15;
const VALID_CATEGORIES = new Set([
  "CORE_BELIEF",
  "EXPERIENCE",
  "RELATIONSHIP",
  "GOAL_FEAR",
  "DAILY_HABIT",
  "PHILOSOPHY",
]);

const RESONANCE_THEMES = [
  {
    theme: "Arsitektur Pikiran & Fokus",
    reflection:
      "Hari ini adalah kanvas bersih untuk menyelaraskan antara apa yang kamu inginkan dan tindakan nyata yang kamu ambil.",
    prompt: "Apa satu hal yang paling layak mendapatkan fokus dan energi terbaikmu hari ini?",
    moodAura: "#6366f1",
  },
  {
    theme: "Resonansi Emosi & Ketenangan",
    reflection:
      "Dalam kecepatan dunia yang serba instan, kemampuan untuk berhenti sejenak dan merasakan adalah kekuatan sejati.",
    prompt: "Bagaimana kondisimu saat ini—apakah pikiranmu sedang penuh, atau siap melangkah?",
    moodAura: "#ec4899",
  },
  {
    theme: "Eksplorasi & Keberanian Melangkah",
    reflection:
      "Setiap lompatan besar selalu dimulai dari keputusan kecil yang diambil dengan keyakinan penuh.",
    prompt: "Jika rasa takut gagal dihapus sepenuhnya, langkah apa yang ingin kamu mulai hari ini?",
    moodAura: "#f59e0b",
  },
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeBeliefs(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AppError(502, "Respons konsolidasi tidak valid, coba lagi");
  }
  const beliefs = [];
  for (const item of raw.slice(0, MAX_CORE_BELIEFS)) {
    if (!item || typeof item !== "object") {
      throw new AppError(502, "Respons konsolidasi tidak valid, coba lagi");
    }
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (content.length === 0 || content.length > 500) {
      throw new AppError(502, "Respons konsolidasi tidak valid, coba lagi");
    }
    const rawCategory = String(item.category || "").toUpperCase();
    const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "CORE_BELIEF";
    const importance = Number(item.importance);
    beliefs.push({
      content,
      category,
      importance: Number.isFinite(importance)
        ? Math.min(Math.max(importance, 0), 1)
        : 0.8,
    });
  }
  return beliefs;
}

function validateConsolidation(payload) {
  if (!payload || typeof payload !== "object") {
    throw new AppError(502, "Respons konsolidasi tidak valid, coba lagi");
  }
  const theme = typeof payload.theme === "string" ? payload.theme.trim() : "";
  const reflection =
    typeof payload.reflection === "string" ? payload.reflection.trim() : "";
  if (theme.length === 0 || theme.length > 120) {
    throw new AppError(502, "Respons konsolidasi tidak valid, coba lagi");
  }
  if (reflection.length === 0 || reflection.length > 1000) {
    throw new AppError(502, "Respons konsolidasi tidak valid, coba lagi");
  }
  return {
    theme,
    reflection,
    coreBeliefs: normalizeBeliefs(payload.coreBeliefs),
  };
}

/**
 * Consolidate recent short-term memories into durable core beliefs.
 *
 * Only memories that have not been consolidated yet are considered, so
 * repeated runs make progress instead of re-distilling the same rows.
 */
async function consolidateMemories({ userId }) {
  const { llm, byok } = await getLlmForUser(userId);

  return withQuotaForUser(userId, byok, async () => {
    const shortTerms = await prisma.memory.findMany({
      where: {
        userId,
        type: "SHORT_TERM",
        deletedAt: null,
        consolidatedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_CONSOLIDATION_BATCH,
    });

    if (shortTerms.length < 2) {
      throw new AppError(400, "Belum cukup memori baru untuk konsolidasi");
    }

    const memoryTexts = shortTerms.map((m) => `- ${m.content}`).join("\n");

    const prompt = `Berikut adalah beberapa interaksi/memori jangka pendek terbaru dari user:
${memoryTexts}

Lakukan proses "Subconscious Memory Consolidation" (seperti siklus tidur REM pada otak manusia):
1. Temukan 1-3 pola pikir, preferensi konsisten, atau keyakinan inti (Core Belief) yang tersirat.
2. Formulasikan sintesis memori permanen.

Kembalikan format JSON:
{
  "theme": "Tema Konsolidasi (misal: Ambisi Kreatif & Keseimbangan)",
  "coreBeliefs": [
    { "content": "Pernyataan keyakinan / fakta permanen", "category": "CORE_BELIEF", "importance": 0.85 }
  ],
  "reflection": "Ringkasan reflektif mengenai perkembangan user akhir-akhir ini"
}
Kategori yang valid: CORE_BELIEF, EXPERIENCE, RELATIONSHIP, GOAL_FEAR, DAILY_HABIT, PHILOSOPHY.
HANYA RETURN JSON VALID!`;

    let parsed;
    try {
      const response = await llm.invoke(prompt);
      const text =
        typeof response?.content === "string"
          ? response.content
          : Array.isArray(response?.content)
            ? response.content.map((c) => (typeof c === "string" ? c : c.text || "")).join("")
            : "";
      parsed = parseLlmJson(text);
    } catch (err) {
      logger.warn({
        message: "Dream consolidation LLM call failed",
        userId,
        error: err.message,
      });
      throw new AppError(502, "Respons konsolidasi tidak valid, coba lagi");
    }

    const { theme, reflection, coreBeliefs } = validateConsolidation(parsed);

    const savedBeliefs = [];
    for (const belief of coreBeliefs) {
      try {
        await saveMemory({
          userId,
          content: belief.content,
          type: "SEMANTIC",
          category: belief.category,
          importanceScore: belief.importance,
          emotionalValence: 0.2,
        });
        savedBeliefs.push(belief);
      } catch (err) {
        logger.error({
          message: "Failed to save consolidated core belief",
          userId,
          error: err.message,
        });
        throw new AppError(502, "Gagal menyimpan keyakinan inti");
      }
    }

    const now = new Date();
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.dreamEntry.create({
        data: {
          userId,
          theme,
          reflection,
          coreBeliefs: savedBeliefs,
          consolidatedCount: shortTerms.length,
        },
      });
      await tx.memory.updateMany({
        where: { id: { in: shortTerms.map((m) => m.id) } },
        data: { consolidatedAt: now },
      });
      return created;
    });

    return {
      id: entry.id,
      theme: entry.theme,
      reflection: entry.reflection,
      coreBeliefs: savedBeliefs,
      consolidatedCount: entry.consolidatedCount,
      createdAt: entry.createdAt,
    };
  });
}

/**
 * Today's Daily Resonance. One row per (user, local day); the theme is picked
 * deterministically from the user + day so two concurrent requests agree.
 */
async function getDailyResonance(userId) {
  const dayKey = localDateKey(new Date());

  const existing = await prisma.dailyResonance.findFirst({
    where: { userId, dayKey, deletedAt: null },
  });
  if (existing) return existing;

  const pick =
    RESONANCE_THEMES[hashString(`${userId}:${dayKey}`) % RESONANCE_THEMES.length];

  return prisma.dailyResonance.upsert({
    where: { userId_dayKey: { userId, dayKey } },
    update: {},
    create: {
      userId,
      date: startOfDay(),
      dayKey,
      theme: pick.theme,
      reflection: pick.reflection,
      prompt: pick.prompt,
      moodAura: pick.moodAura,
    },
  });
}

async function getDreamJournal(userId) {
  return prisma.dreamEntry.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

module.exports = {
  consolidateMemories,
  getDailyResonance,
  getDreamJournal,
};
