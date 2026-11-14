"use strict";

const { prisma } = require("../config/db");
const { logger } = require("../config/logger");
const { startOfDay, localDateKey } = require("../utils/date");

const PERSONALITY_TRAITS = ["empathy", "logic", "humor", "confidence", "playfulness"];
const SUMMARY_TTL_MS = 10 * 60 * 1000;

// userId -> { value: string, expiresAt: number }
const summaryCache = new Map();

async function getChatInsights(userId) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const [totalChats, last7Days, last30Days, recentConvos] = await Promise.all([
    prisma.conversation.count({
      where: { userId, deletedAt: null },
    }),
    prisma.conversation.findMany({
      where: { userId, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, emotion: true },
    }),
    prisma.conversation.count({
      where: { userId, deletedAt: null, createdAt: { gte: monthAgo } },
    }),
    prisma.conversation.findMany({
      where: { userId, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      select: { emotion: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  // Aggregate last 7 days by local day
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = localDateKey(new Date(now.getTime() - i * 86400000));
    days.push({ date: key, count: 0 });
  }
  const dayMap = new Map(days.map((d) => [d.date, d]));
  for (const c of last7Days) {
    const key = localDateKey(c.createdAt);
    if (dayMap.has(key)) dayMap.get(key).count++;
  }

  // Aggregate top emotions
  const emotionCounts = new Map();
  let totalConfidence = 0;
  let confidenceCount = 0;
  for (const c of recentConvos) {
    const label = c.emotion?.emotion || "unknown";
    const conf = c.emotion?.confidence || 0;
    emotionCounts.set(label, (emotionCounts.get(label) || 0) + 1);
    totalConfidence += conf;
    if (conf > 0) confidenceCount++;
  }
  const topEmotions = [...emotionCounts.entries()]
    .map(([emotion, count]) => ({ emotion, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalChats,
    chatsThisWeek: last7Days.length,
    chatsThisMonth: last30Days,
    avgConfidence:
      confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : 0,
    dailyActivity: days,
    topEmotions,
  };
}

async function getMoodTimeline(userId, days = 30) {
  const start = startOfDay(new Date(Date.now() - (days - 1) * 86400000));
  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      deletedAt: null,
      createdAt: { gte: start },
    },
    select: { createdAt: true, emotion: true },
    orderBy: { createdAt: "asc" },
  });

  // Initialize all days
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const key = localDateKey(new Date(Date.now() - i * 86400000));
    buckets.set(key, { date: key, total: 0, emotions: {} });
  }

  for (const c of conversations) {
    const key = localDateKey(c.createdAt);
    if (!buckets.has(key)) continue;
    const bucket = buckets.get(key);
    const label = c.emotion?.emotion || "unknown";
    bucket.emotions[label] = (bucket.emotions[label] || 0) + 1;
    bucket.total += 1;
  }

  const timeline = [...buckets.values()].map((b) => {
    const sorted = Object.entries(b.emotions).sort((a, b) => b[1] - a[1]);
    return {
      date: b.date,
      total: b.total,
      emotions: b.emotions,
      dominant: sorted[0]?.[0] ?? "neutral",
    };
  });

  return { days, timeline };
}

async function getMemoryInsights(userId) {
  const [totalMemories, byTypeRaw, topImportant, mostRecent, avgAgg] = await Promise.all([
    prisma.memory.count({ where: { userId, deletedAt: null } }),
    prisma.memory.groupBy({
      by: ["type"],
      where: { userId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { importanceScore: "desc" },
      take: 5,
      select: {
        id: true,
        content: true,
        type: true,
        importanceScore: true,
        createdAt: true,
      },
    }),
    prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        content: true,
        type: true,
        importanceScore: true,
        createdAt: true,
      },
    }),
    prisma.memory.aggregate({
      where: { userId, deletedAt: null },
      _avg: { importanceScore: true },
    }),
  ]);

  const byType = byTypeRaw.map((g) => ({
    type: g.type,
    count: g._count._all,
  }));

  return {
    totalMemories,
    byType,
    avgImportance: Math.round((avgAgg._avg.importanceScore || 0) * 100) / 100,
    topImportant,
    mostRecent,
  };
}

async function getPersonalityInsights(userId, { includeSummary = false } = {}) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [current, recentHistory] = await Promise.all([
    prisma.personality.findFirst({ where: { userId, deletedAt: null } }),
    prisma.personalityHistory.findMany({
      where: { userId, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!current) {
    return {
      current: null,
      biggestChange: null,
      trend: null,
      summary: null,
    };
  }

  // Find biggest change over the window
  let biggestChange = null;
  const trendByTrait = {};

  if (recentHistory.length >= 2) {
    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];
    for (const t of PERSONALITY_TRAITS) {
      const delta = last[t] - first[t];
      trendByTrait[t] = {
        delta: Math.round(delta * 100) / 100,
        direction: delta > 0.02 ? "increasing" : delta < -0.02 ? "decreasing" : "stable",
      };
      if (biggestChange === null || Math.abs(delta) > Math.abs(biggestChange.delta)) {
        biggestChange = { trait: t, delta: Math.round(delta * 100) / 100 };
      }
    }
  } else {
    for (const t of PERSONALITY_TRAITS) {
      trendByTrait[t] = { delta: 0, direction: "stable" };
    }
  }

  let summary = staticSummary(current, trendByTrait);
  if (includeSummary) {
    const cached = summaryCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      summary = cached.value;
    } else {
      try {
        const generated = await generatePersonalitySummary(current, trendByTrait);
        summary = generated;
        summaryCache.set(userId, {
          value: generated,
          expiresAt: Date.now() + SUMMARY_TTL_MS,
        });
      } catch (err) {
        logger.error({
          message: "Personality summary LLM call failed",
          error: err.message,
        });
      }
    }
  }

  return {
    current,
    biggestChange,
    trend: trendByTrait,
    summary,
  };
}

async function generatePersonalitySummary(current, trend) {
  const { getLlm } = require("../config/openai");
  const { ChatPromptTemplate } = require("@langchain/core/prompts");
  const { StringOutputParser } = require("@langchain/core/output_parsers");

  const traitsStr = Object.entries(trend)
    .map(([k, v]) => `${k}=${(current[k] * 100).toFixed(0)}% (${v.direction})`)
    .join(", ");

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Kamu adalah analis kepribadian digital. Berdasarkan data trait personality user, buat deskripsi natural language 2 kalimat tentang karakter digital twin mereka, dan 1 kalimat saran pengembangan. Jawab dalam Bahasa Indonesia. Jangan pakai bullet point.",
    ],
    ["human", `Trait: ${traitsStr}`],
  ]);

  const chain = prompt.pipe(getLlm()).pipe(new StringOutputParser());
  return await chain.invoke({});
}

function staticSummary(current, trend) {
  const top = Object.entries(trend)
    .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
    .slice(0, 1)[0];
  if (!top)
    return "Personalitas twin kamu masih dalam tahap awal. Terus ngobrol untuk membentuk karakter.";
  return `Trait terkuat kamu adalah ${top[0]} (${(current[top[0]] * 100).toFixed(0)}%). Digital twin kamu mencerminkan gaya kamu yang ${top[1].direction === "increasing" ? "semakin berkembang" : "stabil"} di area ini.`;
}

/**
 * Build a graph of memories based on embedding similarity.
 *
 * Edges are computed pairwise once, then each node keeps only its strongest
 * `maxNeighbors` links. The edge set is emitted in a canonical direction so a
 * pair never appears twice.
 */
async function getMemoryGraph(userId, options = {}) {
  const { limit = 50, similarityThreshold = 0.75, maxNeighbors = 5 } = options;
  const memories = await prisma.memory.findMany({
    where: { userId, deletedAt: null },
    orderBy: { importanceScore: "desc" },
    take: limit,
    select: {
      id: true,
      content: true,
      type: true,
      importanceScore: true,
      createdAt: true,
    },
  });

  if (memories.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Get all vectors via raw SQL
  const vectors = await prisma.$queryRaw`
    SELECT id, embedding::text as embedding
    FROM "Memory"
    WHERE "userId" = ${userId}
      AND "deletedAt" IS NULL
      AND embedding IS NOT NULL
      AND id = ANY(${memories.map((m) => m.id)})
  `;

  const vectorMap = new Map();
  for (const v of vectors) {
    if (!v.embedding) continue;
    const arr = parsePgVector(v.embedding);
    if (arr) vectorMap.set(v.id, arr);
  }

  const validMemories = memories.filter((m) => vectorMap.has(m.id));
  const neighbors = new Map(validMemories.map((m) => [m.id, []]));

  for (let i = 0; i < validMemories.length; i++) {
    const a = validMemories[i];
    const aVec = vectorMap.get(a.id);
    for (let j = i + 1; j < validMemories.length; j++) {
      const b = validMemories[j];
      const sim = cosineSimilarity(aVec, vectorMap.get(b.id));
      if (sim < similarityThreshold) continue;
      const weight = Math.round(sim * 100) / 100;
      neighbors.get(a.id).push({ id: b.id, weight });
      neighbors.get(b.id).push({ id: a.id, weight });
    }
  }

  const edges = [];
  const emitted = new Set();
  for (const [nodeId, list] of neighbors) {
    list.sort((x, y) => y.weight - x.weight);
    for (const { id: otherId, weight } of list.slice(0, maxNeighbors)) {
      const [source, target] = nodeId < otherId ? [nodeId, otherId] : [otherId, nodeId];
      const key = `${source}|${target}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      edges.push({ source, target, weight });
    }
  }

  return {
    nodes: memories.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      importanceScore: m.importanceScore,
      hasVector: vectorMap.has(m.id),
    })),
    edges,
  };
}

function parsePgVector(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/^\[([^\]]+)\]$/);
  if (!match) return null;
  return match[1].split(",").map((n) => parseFloat(n));
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

module.exports = {
  getChatInsights,
  getMemoryInsights,
  getPersonalityInsights,
  getMoodTimeline,
  getMemoryGraph,
};
