"use strict";

const { prisma } = require("../../config/db");
const { detectEmotion } = require("../../services/emotion");
const { streamResponse } = require("../../services/response");
const { evolvePersonality } = require("../../services/evolution");
const { extractMemories } = require("../../services/memory-extraction");
const { saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { formatPersonalityTrend } = require("../../llm/format");
const { createThread, generateThreadTitle } = require("./thread-service");
const { logger } = require("../../config/logger");
const { getLlmForUser } = require("../../services/llm-resolver");
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

async function* processChatStream(userId, message, threadId = null, attachments = []) {
  const start = Date.now();
  logger.debug({ message: "Chat stream pipeline start", userId, threadId });

  const { llm, byok, visionEnabled } = await getLlmForUser(userId);

  if (attachments && attachments.length > MAX_ATTACHMENTS) {
    throw new AppError(400, `Maksimal ${MAX_ATTACHMENTS} lampiran per pesan`);
  }
  assertVisionEnabled(attachments, visionEnabled);

  if (!byok) {
    const { checkAndIncrementQuota } = require("../../services/quota");
    try {
      await checkAndIncrementQuota(userId);
    } catch (err) {
      yield JSON.stringify({ event: "error", message: err.message });
      return;
    }
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
      retrieveMemorySafe({ userId, query: message, limit: 5 }),
      getPersonality(userId),
      getProfile(userId),
      getRecentThreadMessages(activeThreadId, userId),
      getPersonalityTrend(userId),
    ]);

  yield JSON.stringify({ event: "meta", threadId: activeThreadId, emotion });

  const [extractedMemories] = await Promise.all([
    extractMemories({ userInput: message, emotion }, { llm }).catch((err) => {
      logger.warn({ message: "Memory extraction failed, continuing", error: err.message });
      return [];
    }),
  ]);

  let fullResponse = "";
  let fullReasoning = "";
  try {
    for await (const event of streamResponse(
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
  } catch (err) {
    logger.error({
      message: "Stream response failed",
      userId,
      error: err.message,
    });
    yield JSON.stringify({ event: "error", message: "Stream gagal" });
    return;
  }

  try {
    await prisma.conversation.create({
      data: {
        userId,
        threadId: activeThreadId,
        message: message.trim(),
        response: fullResponse,
        reasoning: fullReasoning || null,
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
        logger.error({
          message: "Error generating thread title in background",
          error: err.message,
        });
      });
    }

    yield JSON.stringify({
      event: "done",
      response: fullResponse,
      reasoning: fullReasoning || null,
      emotion,
      personality_snapshot: updatedPersonality,
      threadId: activeThreadId,
    });
  } catch (err) {
    logger.error({
      message: "Post-stream save failed",
      userId,
      error: err.message,
    });
    yield JSON.stringify({
      event: "error",
      message: "Gagal menyimpan percakapan",
    });
    return;
  }

  logger.debug({
    message: "Chat stream pipeline done",
    userId,
    duration: Date.now() - start,
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

module.exports = { processChatStream, getRecentThreadMessages, getProfile };
