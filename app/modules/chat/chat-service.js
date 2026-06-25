"use strict";

const { prisma } = require("../../config/db");
const { detectEmotion } = require("../../services/emotion");
const { generateThought } = require("../../services/thought");
const { generateResponse } = require("../../services/response");
const { evolvePersonality } = require("../../services/evolution");
const { extractMemories } = require("../../services/memory-extraction");
const { retrieveMemory, saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { formatPersonalityTrend } = require("../../llm/format");
const { createThread, generateThreadTitle } = require("./thread-service");
const { assistantChain } = require("../../llm/chains/assistant-chain");
const { logger } = require("../../config/logger");

const THREAD_CONTEXT_LIMIT = 5;

async function getProfile(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, bio: true },
  });
}

async function getRecentThreadMessages(threadId, userId, limit = THREAD_CONTEXT_LIMIT) {
  if (!threadId) return [];
  return prisma.conversation.findMany({
    where: { userId, threadId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { message: true, response: true, createdAt: true },
  });
}

async function getPersonalityTrend(userId, lookback = 5) {
  try {
    const history = await prisma.personalityHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: lookback + 1,
      select: {
        empathy: true,
        logic: true,
        humor: true,
        confidence: true,
        playfulness: true,
        createdAt: true,
      },
    });
    return formatPersonalityTrend(history, lookback);
  } catch (err) {
    logger.warn({ message: "Failed to compute personality trend", error: err.message });
    return "";
  }
}

async function processChat(userId, message, threadId = null, attachments = []) {
  const start = Date.now();
  logger.debug({ message: "Chat pipeline start", userId, threadId });

  const { checkAndIncrementQuota } = require("../../services/quota");
  await checkAndIncrementQuota(userId);

  let activeThreadId = threadId;
  let isNewThread = false;

  if (!activeThreadId) {
    const newThread = await createThread(userId);
    activeThreadId = newThread.id;
    isNewThread = true;
  }

  const [emotion, memories, personality, profile, threadContext, personalityTrend] =
    await Promise.all([
      detectEmotion(message),
      retrieveMemory({ userId, query: message, limit: 5 }),
      getPersonality(userId),
      getProfile(userId),
      getRecentThreadMessages(activeThreadId, userId),
      getPersonalityTrend(userId),
    ]);

  const [reasoning, extractedMemories] = await Promise.all([
    generateThought({
      userInput: message,
      memories,
      personality,
      profile,
      threadContext,
    }),
    extractMemories({ userInput: message, emotion }),
  ]);

  const response = await generateResponse({
    userInput: message,
    name: profile?.name,
    profile,
    personality,
    personalityTrend,
    emotion,
    memories,
    reasoning,
    threadContext,
    attachments,
  });

  await prisma.conversation.create({
    data: {
      userId,
      threadId: activeThreadId,
      message: message.trim(),
      response,
      reasoning,
      emotion,
    },
  });

  await saveMemory({
    userId,
    content: message.trim(),
    type: "SHORT_TERM",
    importanceScore: emotion.emotion !== "neutral" ? 0.7 : 0.4,
  });

  for (const m of extractedMemories) {
    await saveMemory({
      userId,
      content: m.content,
      type: m.type,
      importanceScore: m.importanceScore,
    });
  }

  await evolvePersonality({ userId, emotion });

  const updatedPersonality = await getPersonality(userId);

  if (isNewThread) {
    generateThreadTitle(activeThreadId, userId).catch((err) => {
      logger.error({ message: "Error generating thread title in background", error: err.message });
    });
  }

  const duration = Date.now() - start;
  logger.debug({ message: "Chat pipeline done", userId, duration });

  return {
    response,
    emotion,
    reasoning,
    personality_snapshot: updatedPersonality,
    threadId: activeThreadId,
  };
}

async function getChatHistory(userId, { page = 1, limit = 20, threadId = null } = {}) {
  const skip = (page - 1) * limit;
  const whereClause = { userId, deletedAt: null };

  if (threadId) {
    whereClause.threadId = threadId;
  }

  const [total, conversations] = await Promise.all([
    prisma.conversation.count({ where: whereClause }),
    prisma.conversation.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        message: true,
        response: true,
        reasoning: true,
        emotion: true,
        createdAt: true,
        threadId: true,
      },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: conversations,
  };
}

async function simulateChat(userId, message, opts = {}) {
  const start = Date.now();
  logger.debug({ message: "Simulate chat start", userId });

  const [emotion, memories, personality, profile, threadContext, personalityTrend] =
    await Promise.all([
      detectEmotion(message),
      retrieveMemorySafe({ userId, query: message, limit: 5 }),
      getPersonality(userId),
      getProfile(userId),
      Promise.resolve([]),
      getPersonalityTrend(userId),
    ]);

  const effectivePersonality = opts.personalityOverride
    ? { ...personality, ...opts.personalityOverride }
    : personality;

  const [reasoning, assistantResponse] = await Promise.all([
    generateThought({
      userInput: message,
      memories,
      personality: effectivePersonality,
      profile,
      threadContext,
    }),
    assistantChain.invoke({ userInput: message }),
  ]);

  const response = await generateResponse({
    userInput: message,
    name: profile?.name,
    profile,
    personality: effectivePersonality,
    personalityTrend,
    emotion,
    memories,
    reasoning,
    threadContext,
  });

  const duration = Date.now() - start;
  logger.debug({ message: "Simulate chat done", userId, duration });

  return {
    twin: {
      response,
      reasoning,
      emotion,
      personality_snapshot: effectivePersonality,
    },
    assistant: {
      response: assistantResponse,
    },
  };
}

async function retrieveMemorySafe(args) {
  try {
    const { retrieveMemory } = require("../memory/memory-service");
    return await retrieveMemory(args);
  } catch (err) {
    logger.error({ message: "Memory retrieval failed", error: err.message });
    return [];
  }
}

module.exports = { processChat, getChatHistory, simulateChat, getRecentThreadMessages, getProfile };
