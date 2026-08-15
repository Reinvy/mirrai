"use strict";

const { prisma } = require("../config/db");
const { getLlm } = require("../config/openai");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { logger } = require("../config/logger");

const VALID_PERIODS = new Set([7, 30, 90]);

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function generateRecap(userId, days, { llm } = {}) {
  const start = startOfDay(new Date(Date.now() - (days - 1) * 86400000));
  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      deletedAt: null,
      createdAt: { gte: start },
    },
    orderBy: { createdAt: "asc" },
  });

  if (conversations.length === 0) {
    return {
      days,
      totalChats: 0,
      topEmotions: [],
      summary:
        "Belum ada percakapan dalam periode ini. Mulai ngobrol dengan Mirrai untuk generate recap.",
      keyTopics: [],
      generatedAt: new Date().toISOString(),
    };
  }

  // Aggregate stats
  const emotionCounts = new Map();
  for (const c of conversations) {
    const label = c.emotion?.emotion || "neutral";
    emotionCounts.set(label, (emotionCounts.get(label) || 0) + 1);
  }
  const topEmotions = [...emotionCounts.entries()]
    .map(([emotion, count]) => ({ emotion, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Build a digest of messages for the LLM (cap to avoid token overflow)
  const maxDigest = 30;
  const digest = conversations
    .slice(-maxDigest)
    .map(
      (c, i) => `${i + 1}. [${c.emotion?.emotion || "neutral"}] User: ${c.message.slice(0, 200)}`,
    )
    .join("\n");

  // Try LLM summary, fall back to static
  let summary = "";
  let keyTopics = [];
  try {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `Kamu adalah analis percakapan. Berdasarkan ${conversations.length} chat dalam ${days} hari terakhir, buat ringkasan Bahasa Indonesia dengan format:

SUMMARY: <2-3 kalimat ringkasan tentang apa yang user bicarakan dan bagaimana emosi mereka>
TOPICS: <3-5 topik utama dipisah koma>

Contoh:
SUMMARY: User tampak fokus membahas karier di awal minggu, dengan kecemasan ringan tentang deadline. Menjelang akhir minggu, percakapan bergeser ke refleksi pribadi dan rencana masa depan. Mood dominan: netral-cemas.
TOPICS: karier, deadline, refleksi diri, rencana masa depan`,
      ],
      [
        "human",
        `Top emosi: ${topEmotions.map((e) => `${e.emotion}(${e.count})`).join(", ")}\n\nPercakapan:\n${digest}`,
      ],
    ]);

    const chain = prompt.pipe(llm || getLlm()).pipe(new StringOutputParser());
    const result = await chain.invoke({});

    const summaryMatch = result.match(/SUMMARY:\s*([\s\S]+?)(?=TOPICS:|$)/i);
    const topicsMatch = result.match(/TOPICS:\s*([\s\S]+?)$/i);

    summary = summaryMatch ? summaryMatch[1].trim() : result.trim();
    if (topicsMatch) {
      keyTopics = topicsMatch[1]
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 5);
    }
  } catch (err) {
    logger.error({
      message: "Recap LLM call failed",
      error: err.message,
    });
    summary = `Recap periode ${days} hari: total ${conversations.length} chat, emosi dominan ${topEmotions[0]?.emotion || "neutral"}. LLM unavailable, summary statis.`;
    keyTopics = ["(LLM unavailable)"];
  }

  return {
    days,
    totalChats: conversations.length,
    topEmotions,
    summary,
    keyTopics,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateRecap, VALID_PERIODS: [...VALID_PERIODS] };
