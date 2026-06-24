"use strict";

const { prisma } = require("../config/db");
const { logger } = require("../config/logger");

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

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

  // Aggregate last 7 days by day
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDay(new Date(now.getTime() - i * 86400000));
    days.push({ date: dayStart.toISOString().slice(0, 10), count: 0 });
  }
  const dayMap = new Map(days.map((d) => [d.date, d]));
  for (const c of last7Days) {
    const key = startOfDay(c.createdAt).toISOString().slice(0, 10);
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
      confidenceCount > 0
        ? Math.round((totalConfidence / confidenceCount) * 100) / 100
        : 0,
    dailyActivity: days,
    topEmotions,
  };
}

async function getMemoryInsights(userId) {
  const [totalMemories, byTypeRaw, topImportant, mostRecent, avgAgg] =
    await Promise.all([
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
    avgImportance:
      Math.round((avgAgg._avg.importanceScore || 0) * 100) / 100,
    topImportant,
    mostRecent,
  };
}

async function getPersonalityInsights(userId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [current, recentHistory] = await Promise.all([
    prisma.personality.findUnique({ where: { userId } }),
    prisma.personalityHistory.findMany({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
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
  const traits = [
    "empathy",
    "logic",
    "humor",
    "confidence",
    "playfulness",
  ];
  let biggestChange = null;
  let trendByTrait = {};

  if (recentHistory.length >= 2) {
    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];
    for (const t of traits) {
      const delta = last[t] - first[t];
      trendByTrait[t] = {
        delta: Math.round(delta * 100) / 100,
        direction:
          delta > 0.02 ? "increasing" : delta < -0.02 ? "decreasing" : "stable",
      };
      if (
        biggestChange === null ||
        Math.abs(delta) > Math.abs(biggestChange.delta)
      ) {
        biggestChange = { trait: t, delta: Math.round(delta * 100) / 100 };
      }
    }
  } else {
    for (const t of traits) {
      trendByTrait[t] = { delta: 0, direction: "stable" };
    }
  }

  // LLM summary (best effort, fallback to static)
  let summary = null;
  try {
    summary = await generatePersonalitySummary(current, trendByTrait);
  } catch (err) {
    logger.error({
      message: "Personality summary LLM call failed",
      error: err.message,
    });
    summary = staticSummary(current, trendByTrait);
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
  if (!top) return "Personalitas twin kamu masih dalam tahap awal. Terus ngobrol untuk membentuk karakter.";
  return `Trait terkuat kamu adalah ${top[0]} (${(current[top[0]] * 100).toFixed(0)}%). Digital twin kamu mencerminkan gaya kamu yang ${top[1].direction === "increasing" ? "semakin berkembang" : "stabil"} di area ini.`;
}

module.exports = {
  getChatInsights,
  getMemoryInsights,
  getPersonalityInsights,
};
