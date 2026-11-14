"use strict";

const { prisma } = require("../../config/db");
const { detectEmotion } = require("../../services/emotion");
const { streamResponse } = require("../../services/response");
const { evolvePersonality } = require("../../services/evolution");
const { extractMemories } = require("../../services/memory-extraction");
const { saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { formatPersonalityTrend } = require("../../llm/format");
const { createThread, generateThreadTitle, getOwnedThread } = require("./thread-service");
const { logger } = require("../../config/logger");
const { getLlmForUser } = require("../../services/llm-resolver");
const { refundQuota } = require("../../services/quota");
const { normalizePersona } = require("../../llm/personas");
const { AppError } = require("../../utils/app-error");
const { assertVisionEnabled, MAX_ATTACHMENTS } = require("./chat-service");

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

async function retrieveMemorySafe(args) {
  try {
    const { retrieveMemory } = require("../memory/memory-service");
    return await retrieveMemory(args);
  } catch (err) {
    logger.error({ message: "Memory retrieval failed", error: err.message });
    return [];
  }
}

/**
 * Everything that can fail with a meaningful HTTP status runs here, before the
 * SSE headers go out: auth is a middleware, so this covers LLM resolution,
 * attachment validation, thread ownership, quota, and context loading.
 */
async function prepareChatStream(userId, message, threadId, attachments, persona) {
  const { llm, byok, visionEnabled } = await getLlmForUser(userId);

  if (attachments && attachments.length > MAX_ATTACHMENTS) {
    throw new AppError(400, `Maksimal ${MAX_ATTACHMENTS} lampiran per pesan`);
  }
  assertVisionEnabled(attachments, visionEnabled);

  let activeThreadId = null;
  if (threadId) {
    await getOwnedThread(threadId, userId);
    activeThreadId = threadId;
  }

  let quotaCharged = false;
  if (!byok) {
    const { checkAndIncrementQuota } = require("../../services/quota");
    await checkAndIncrementQuota(userId);
    quotaCharged = true;
  } else {
    logger.debug({ message: "BYOK active, skipping quota check", userId });
  }

  let createdThread = false;
  try {
    if (!activeThreadId) {
      const newThread = await createThread(userId);
      activeThreadId = newThread.id;
      createdThread = true;
    }

    const [emotion, memories, personality, profile, threadContext, personalityTrend] =
      await Promise.all([
        detectEmotion(message, { llm }),
        retrieveMemorySafe({ userId, query: message, limit: 5 }),
        getPersonality(userId),
        getProfile(userId),
        getRecentThreadMessages(activeThreadId, userId),
        getPersonalityTrend(userId),
      ]);

    return {
      userId,
      threadId: activeThreadId,
      createdThread,
      llm,
      byok,
      quotaCharged,
      emotion,
      memories,
      personality,
      profile,
      threadContext,
      personalityTrend,
      message,
      attachments: attachments || [],
      persona: normalizePersona(persona),
    };
  } catch (err) {
    if (quotaCharged) {
      await refundQuota(userId).catch(() => {});
    }
    if (createdThread && activeThreadId) {
      await prisma.thread
        .update({
          where: { id: activeThreadId },
          data: { deletedAt: new Date() },
        })
        .catch(() => {});
    }
    throw err;
  }
}

async function persistConversation(prep, { response, reasoning, partial }) {
  return prisma.conversation.create({
    data: {
      userId: prep.userId,
      threadId: prep.threadId,
      message: prep.message.trim(),
      response,
      reasoning: reasoning || null,
      emotion: prep.emotion,
      persona: prep.persona,
      partial,
    },
  });
}

async function runPostPersistSideEffects(prep, extractedMemories) {
  const tasks = [
    saveMemory({
      userId: prep.userId,
      content: prep.message.trim(),
      type: "SHORT_TERM",
      importanceScore: prep.emotion.emotion !== "neutral" ? 0.7 : 0.4,
    }),
    ...extractedMemories.map((m) =>
      saveMemory({
        userId: prep.userId,
        content: m.content,
        type: m.type,
        category: m.category,
        importanceScore: m.importanceScore,
      }),
    ),
    evolvePersonality({ userId: prep.userId, emotion: prep.emotion }),
  ];

  const results = await Promise.allSettled(tasks);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.warn({
        message: "Chat post-persist side effect failed",
        userId: prep.userId,
        index,
        error: result.reason?.message,
      });
    }
  });
}

async function* streamPreparedChat(prep, { signal } = {}) {
  const start = Date.now();
  let fullResponse = "";
  let fullReasoning = "";
  let completed = false;
  let persisted = false;

  yield JSON.stringify({
    event: "meta",
    threadId: prep.threadId,
    emotion: prep.emotion,
    persona: prep.persona,
  });

  // Memory extraction runs alongside the token stream; its result is only
  // needed after the conversation row exists.
  const extractionPromise = extractMemories(
    { userInput: prep.message, emotion: prep.emotion },
    { llm: prep.llm },
  ).catch((err) => {
    logger.warn({ message: "Memory extraction failed, continuing", error: err.message });
    return [];
  });

  try {
    for await (const event of streamResponse(
      {
        userInput: prep.message,
        name: prep.profile?.name,
        profile: prep.profile,
        personality: prep.personality,
        personalityTrend: prep.personalityTrend,
        emotion: prep.emotion,
        memories: prep.memories,
        threadContext: prep.threadContext,
        attachments: prep.attachments,
        persona: prep.persona,
      },
      { llm: prep.llm, signal },
    )) {
      if (event.type === "reasoning") {
        if (event.text) {
          fullReasoning += event.text;
          yield JSON.stringify({ event: "reasoning", reasoning: event.text });
        }
      } else if (event.type === "delta") {
        fullResponse += event.text;
        yield JSON.stringify({ event: "delta", text: event.text });
      }
    }
    completed = true;
  } catch (err) {
    const aborted = Boolean(signal?.aborted) || err?.name === "AbortError";
    logger.warn({
      message: aborted ? "Stream aborted by client" : "Stream response failed",
      userId: prep.userId,
      error: err.message,
    });
    if (!aborted) {
      yield JSON.stringify({ event: "error", message: "Stream gagal" });
    }
  } finally {
    if (!persisted) {
      if (fullResponse.trim()) {
        try {
          await persistConversation(prep, {
            response: fullResponse,
            reasoning: fullReasoning,
            partial: true,
          });
          persisted = true;
        } catch (err) {
          logger.error({
            message: "Failed to persist partial conversation",
            userId: prep.userId,
            error: err.message,
          });
          if (prep.quotaCharged) {
            await refundQuota(prep.userId).catch(() => {});
          }
        }
      } else {
        if (!completed && prep.createdThread) {
          await prisma.thread
            .update({
              where: { id: prep.threadId },
              data: { deletedAt: new Date() },
            })
            .catch(() => {});
        }
        if (!completed && prep.quotaCharged) {
          await refundQuota(prep.userId).catch(() => {});
        }
      }
    }
  }

  if (!persisted) {
    return;
  }

  const extractedMemories = await extractionPromise;
  await runPostPersistSideEffects(prep, extractedMemories);

  let updatedPersonality = prep.personality;
  try {
    updatedPersonality = await getPersonality(prep.userId);
  } catch (err) {
    logger.warn({
      message: "Failed to reload personality after chat",
      userId: prep.userId,
      error: err.message,
    });
  }

  let titleResult = { changed: false };
  if (!signal?.aborted && fullResponse.trim()) {
    try {
      const convCount = await prisma.conversation.count({
        where: { threadId: prep.threadId, userId: prep.userId, deletedAt: null },
      });
      titleResult = await generateThreadTitle(prep.threadId, prep.userId, {
        llm: prep.llm,
        conversationCount: convCount,
      });
    } catch (err) {
      logger.warn({
        message: "Thread title generation failed",
        userId: prep.userId,
        error: err.message,
      });
    }
  }

  if (titleResult.changed) {
    yield JSON.stringify({
      event: "title",
      threadId: prep.threadId,
      title: titleResult.title,
    });
  }

  yield JSON.stringify({
    event: "done",
    response: fullResponse,
    reasoning: fullReasoning || null,
    emotion: prep.emotion,
    personality_snapshot: updatedPersonality,
    threadId: prep.threadId,
    persona: prep.persona,
    partial: false,
  });

  logger.debug({
    message: "Chat stream pipeline done",
    userId: prep.userId,
    duration: Date.now() - start,
  });
}

module.exports = {
  prepareChatStream,
  streamPreparedChat,
  persistConversation,
  runPostPersistSideEffects,
  getRecentThreadMessages,
  getProfile,
};
