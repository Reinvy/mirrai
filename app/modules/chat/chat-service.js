"use strict";

const { prisma } = require("../../config/db");
const { detectEmotion } = require("../../services/emotion");
const { generateResponse, streamResponse } = require("../../services/response");
const { evolvePersonality } = require("../../services/evolution");
const { extractMemories } = require("../../services/memory-extraction");
const { retrieveMemory, saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { formatPersonalityTrend } = require("../../llm/format");
const { createThread, generateThreadTitle } = require("./thread-service");
const { assistantChain } = require("../../llm/chains/assistant-chain");
const { logger } = require("../../config/logger");
const { getLlmForUser } = require("../../services/llm-resolver");
const { AppError } = require("../../utils/app-error");

const THREAD_CONTEXT_LIMIT = 5;
const MAX_ATTACHMENTS = 4;

function assertVisionEnabled(attachments, visionEnabled) {
  if (attachments && attachments.length > 0 && !visionEnabled) {
    throw new AppError(
      400,
      "Lampiran gambar tidak didukung. Aktifkan vision di BYOK settings untuk mengirim gambar.",
    );
  }
}

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

  const { llm, byok, thinkingEnabled, visionEnabled } = await getLlmForUser(userId);

  if (attachments && attachments.length > MAX_ATTACHMENTS) {
    throw new AppError(400, `Maksimal ${MAX_ATTACHMENTS} lampiran per pesan`);
  }
  assertVisionEnabled(attachments, visionEnabled);

  if (!byok) {
    const { checkAndIncrementQuota } = require("../../services/quota");
    await checkAndIncrementQuota(userId);
  } else {
    logger.debug({ message: "BYOK active, skipping quota check", userId });
  }

  let activeThreadId = threadId;
  let isNewThread = false;

  if (!activeThreadId) {
    const newThread = await createThread(userId);
    activeThreadId = newThread.id;
    isNewThread = true;
  }

  const [emotion, memories, personality, profile, threadContext, personalityTrend] =
    await Promise.all([
      detectEmotion(message, { llm }),
      retrieveMemory({ userId, query: message, limit: 5 }),
      getPersonality(userId),
      getProfile(userId),
      getRecentThreadMessages(activeThreadId, userId),
      getPersonalityTrend(userId),
    ]);

  const [extractedMemories, responseResult] = await Promise.all([
    extractMemories({ userInput: message, emotion }, { llm }).catch((err) => {
      logger.warn({ message: "Memory extraction failed, continuing", error: err.message });
      return [];
    }),
    generateResponse(
      {
        userInput: message,
        name: profile?.name,
        profile,
        personality,
        personalityTrend,
        emotion,
        memories,
        threadContext,
        attachments,
      },
      { llm },
    ),
  ]);

  const response = responseResult.text;
  const reasoning = responseResult.reasoning;

  await prisma.conversation.create({
    data: {
      userId,
      threadId: activeThreadId,
      message: message.trim(),
      response,
      reasoning: reasoning || null,
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
    generateThreadTitle(activeThreadId, userId, { llm }).catch((err) => {
      logger.error({ message: "Error generating thread title in background", error: err.message });
    });
  }

  const duration = Date.now() - start;
  logger.debug({ message: "Chat pipeline done", userId, duration });

  return {
    response,
    reasoning: reasoning || null,
    emotion,
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

  const { llm, visionEnabled } = await getLlmForUser(userId);
  assertVisionEnabled([], visionEnabled);

  const [emotion, memories, personality, profile, threadContext, personalityTrend] =
    await Promise.all([
      detectEmotion(message, { llm }),
      retrieveMemorySafe({ userId, query: message, limit: 5 }),
      getPersonality(userId),
      getProfile(userId),
      Promise.resolve([]),
      getPersonalityTrend(userId),
    ]);

  const effectivePersonality = opts.personalityOverride
    ? { ...personality, ...opts.personalityOverride }
    : personality;

  const [assistantResponse, { text: response, reasoning }] = await Promise.all([
    assistantChain.invoke({ userInput: message }, { llm }),
    generateResponse(
      {
        userInput: message,
        name: profile?.name,
        profile,
        personality: effectivePersonality,
        personalityTrend,
        emotion,
        memories,
        threadContext,
      },
      { llm },
    ),
  ]);

  const duration = Date.now() - start;
  logger.debug({ message: "Simulate chat done", userId, duration });

  return {
    twin: {
      response,
      reasoning: reasoning || null,
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

module.exports = {
  processChat,
  getChatHistory,
  simulateChat,
  getRecentThreadMessages,
  getProfile,
  MAX_ATTACHMENTS,
  assertVisionEnabled,
};
