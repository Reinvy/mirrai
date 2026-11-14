"use strict";

const { prisma } = require("../../config/db");
const { detectEmotion } = require("../../services/emotion");
const { generateResponse } = require("../../services/response");
const { evolvePersonality } = require("../../services/evolution");
const { extractMemories } = require("../../services/memory-extraction");
const { retrieveMemory, saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { formatPersonalityTrend } = require("../../llm/format");
const { createThread, generateThreadTitle, getOwnedThread } = require("./thread-service");
const { assistantChain } = require("../../llm/chains/assistant-chain");
const { logger } = require("../../config/logger");
const { getLlmForUser } = require("../../services/llm-resolver");
const { withQuotaForUser } = require("../../services/quota");
const { normalizePersona } = require("../../llm/personas");
const { AppError } = require("../../utils/app-error");

const THREAD_CONTEXT_LIMIT = 5;
const MAX_ATTACHMENTS = 4;
const PERSONALITY_TRAITS = ["empathy", "logic", "humor", "confidence", "playfulness"];

function assertVisionEnabled(attachments, visionEnabled) {
  if (attachments && attachments.length > 0 && !visionEnabled) {
    throw new AppError(
      400,
      "Lampiran gambar tidak didukung. Aktifkan vision di BYOK settings untuk mengirim gambar.",
    );
  }
}

function assertPersonalityOverride(override) {
  if (override === undefined || override === null) return null;
  if (typeof override !== "object" || Array.isArray(override)) {
    throw new AppError(400, "personalityOverride harus berupa objek trait");
  }
  const clean = {};
  let provided = 0;
  for (const trait of PERSONALITY_TRAITS) {
    const value = override[trait];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new AppError(400, `Nilai ${trait} harus berupa angka 0-1`);
    }
    clean[trait] = value;
    provided += 1;
  }
  return provided > 0 ? clean : null;
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
      where: { userId, deletedAt: null },
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

async function softDeleteThread(threadId) {
  await prisma.thread
    .update({ where: { id: threadId }, data: { deletedAt: new Date() } })
    .catch(() => {});
}

async function runPostPersistSideEffects(userId, message, emotion, extractedMemories) {
  const tasks = [
    saveMemory({
      userId,
      content: message.trim(),
      type: "SHORT_TERM",
      importanceScore: emotion.emotion !== "neutral" ? 0.7 : 0.4,
    }),
    ...extractedMemories.map((m) =>
      saveMemory({
        userId,
        content: m.content,
        type: m.type,
        category: m.category,
        importanceScore: m.importanceScore,
      }),
    ),
    evolvePersonality({ userId, emotion }),
  ];
  const results = await Promise.allSettled(tasks);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.warn({
        message: "Chat post-persist side effect failed",
        userId,
        index,
        error: result.reason?.message,
      });
    }
  });
}

async function processChat(userId, message, threadId = null, attachments = [], persona) {
  const start = Date.now();
  logger.debug({ message: "Chat pipeline start", userId, threadId });

  const { llm, byok, visionEnabled } = await getLlmForUser(
    userId,
    threadId ? { sessionId: `mirrai-thread-${threadId}` } : undefined,
  );

  if (attachments && attachments.length > MAX_ATTACHMENTS) {
    throw new AppError(400, `Maksimal ${MAX_ATTACHMENTS} lampiran per pesan`);
  }
  assertVisionEnabled(attachments, visionEnabled);

  let activeThreadId = null;
  if (threadId) {
    await getOwnedThread(threadId, userId);
    activeThreadId = threadId;
  }

  const activePersona = normalizePersona(persona);

  return withQuotaForUser(userId, byok, async () => {
    let createdThread = false;
    if (!activeThreadId) {
      const newThread = await createThread(userId);
      activeThreadId = newThread.id;
      createdThread = true;
    }

    let response;
    let reasoning;
    let emotion;
    let personality;
    let personalityTrend;
    let extractedMemories;

    try {
      const [
        emotionResult,
        memories,
        personalityResult,
        profile,
        threadContext,
        trendResult,
      ] = await Promise.all([
        detectEmotion(message, { llm }),
        retrieveMemory({ userId, query: message, limit: 5 }),
        getPersonality(userId),
        getProfile(userId),
        getRecentThreadMessages(activeThreadId, userId),
        getPersonalityTrend(userId),
      ]);

      emotion = emotionResult;
      personality = personalityResult;
      personalityTrend = trendResult;

      const [extracted, responseResult] = await Promise.all([
        extractMemories({ userInput: message, emotion }, { llm }).catch((err) => {
          logger.warn({
            message: "Memory extraction failed, continuing",
            error: err.message,
          });
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
            persona: activePersona,
          },
          { llm },
        ),
      ]);

      extractedMemories = extracted;
      response = responseResult.text;
      reasoning = responseResult.reasoning;

      // The conversation row is the contract with the client: if it does not
      // exist, the request failed. Everything after this is best-effort.
      await prisma.conversation.create({
        data: {
          userId,
          threadId: activeThreadId,
          message: message.trim(),
          response,
          reasoning: reasoning || null,
          emotion,
          persona: activePersona,
          partial: false,
        },
      });
    } catch (err) {
      if (createdThread) {
        await softDeleteThread(activeThreadId);
      }
      throw err;
    }

    await runPostPersistSideEffects(userId, message, emotion, extractedMemories);

    let updatedPersonality = personality;
    try {
      updatedPersonality = await getPersonality(userId);
    } catch (err) {
      logger.warn({
        message: "Failed to reload personality after chat",
        userId,
        error: err.message,
      });
    }

    let titleResult = { changed: false };
    try {
      const convCount = await prisma.conversation.count({
        where: { threadId: activeThreadId, userId, deletedAt: null },
      });
      titleResult = await generateThreadTitle(activeThreadId, userId, {
        llm,
        conversationCount: convCount,
      });
    } catch (err) {
      logger.warn({
        message: "Thread title generation failed",
        userId,
        error: err.message,
      });
    }

    logger.debug({ message: "Chat pipeline done", userId, duration: Date.now() - start });

    const result = {
      response,
      reasoning: reasoning || null,
      emotion,
      personality_snapshot: updatedPersonality,
      threadId: activeThreadId,
      persona: activePersona,
      partial: false,
    };
    if (titleResult.changed) {
      result.title = titleResult.title;
    }
    return result;
  });
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
        persona: true,
        partial: true,
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

  const override = assertPersonalityOverride(opts.personalityOverride);
  const { llm, byok } = await getLlmForUser(userId);

  return withQuotaForUser(userId, byok, async () => {
    const [emotion, memories, personality, profile, threadContext, personalityTrend] =
      await Promise.all([
        detectEmotion(message, { llm }),
        retrieveMemorySafe({ userId, query: message, limit: 5 }),
        getPersonality(userId),
        getProfile(userId),
        Promise.resolve([]),
        getPersonalityTrend(userId),
      ]);

    const effectivePersonality = override
      ? { ...personality, ...override }
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

    logger.debug({ message: "Simulate chat done", userId, duration: Date.now() - start });

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
  });
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
