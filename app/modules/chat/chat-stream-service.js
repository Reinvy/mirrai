"use strict";

const { prisma } = require("../../config/db");
const { detectEmotion } = require("../../services/emotion");
const { generateThought } = require("../../services/thought");
const { streamDecision } = require("../../services/decision");
const { evolvePersonality } = require("../../services/evolution");
const { saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { createThread, generateThreadTitle } = require("./thread-service");
const { logger } = require("../../config/logger");

/**
 * Run the 8-step chat pipeline with streaming final response.
 * Yields SSE event payloads (already JSON-stringified) to be written to res.
 *
 * Step order:
 *  1. Create thread if needed
 *  2-3. Concurrently: emotion, memory, personality
 *  4. Thought
 *  5. Stream decision (one event per token)
 *  6-8. Save conversation, save memory, evolve personality (after stream)
 *  +. Background thread title generation for new thread
 */
async function* processChatStream(userId, message, threadId = null) {
  const start = Date.now();
  logger.debug({ message: "Chat stream pipeline start", userId, threadId });

  let activeThreadId = threadId;
  let isNewThread = false;

  if (!activeThreadId) {
    const newThread = await createThread(userId);
    activeThreadId = newThread.id;
    isNewThread = true;
  }

  // Steps 2-3 in parallel
  const [emotion, memories, personality] = await Promise.all([
    detectEmotion(message),
    retrieveMemorySafe({ userId, query: message, limit: 5 }),
    getPersonality(userId),
  ]);

  yield JSON.stringify({ event: "meta", threadId: activeThreadId, emotion });

  // Step 4
  const reasoning = await generateThought({
    userInput: message,
    memories,
    personality,
  });

  yield JSON.stringify({ event: "reasoning", reasoning });

  // Step 5 — stream
  let fullResponse = "";
  try {
    for await (const delta of streamDecision({
      userInput: message,
      emotion,
      memories,
      personality,
      reasoning,
    })) {
      fullResponse += delta;
      yield JSON.stringify({ event: "delta", text: delta });
    }
  } catch (err) {
    logger.error({
      message: "Stream decision failed",
      userId,
      error: err.message,
    });
    yield JSON.stringify({ event: "error", message: "Stream gagal" });
    return;
  }

  // Steps 6-8: save conversation, save memory, evolve personality
  try {
    await prisma.conversation.create({
      data: {
        userId,
        threadId: activeThreadId,
        message: message.trim(),
        response: fullResponse,
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

    await evolvePersonality({ userId, emotion });

    const updatedPersonality = await getPersonality(userId);

    if (isNewThread) {
      generateThreadTitle(activeThreadId, userId).catch((err) => {
        logger.error({
          message: "Error generating thread title in background",
          error: err.message,
        });
      });
    }

    yield JSON.stringify({
      event: "done",
      response: fullResponse,
      reasoning,
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

module.exports = { processChatStream };
