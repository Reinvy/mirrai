"use strict";

const { prisma } = require("../../config/db");
const { detectEmotion } = require("../../services/emotion");
const { generateThought } = require("../../services/thought");
const { generateDecision } = require("../../services/decision");
const { evolvePersonality } = require("../../services/evolution");
const { retrieveMemory, saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { createThread, generateThreadTitle } = require("./thread-service");
const { assistantChain } = require("../../llm/chains/assistant-chain");
const { logger } = require("../../config/logger");

async function processChat(userId, message, threadId = null, attachments = []) {
  const start = Date.now();
  logger.debug({ message: "Chat pipeline start", userId, threadId });

  let activeThreadId = threadId;
  let isNewThread = false;

  if (!activeThreadId) {
    const newThread = await createThread(userId);
    activeThreadId = newThread.id;
    isNewThread = true;
  }

  // Step 1, 2, & 3: Run Emotion, Memory, and Personality retrieval concurrently
  const [emotion, memories, personality] = await Promise.all([
    detectEmotion(message),
    retrieveMemory({ userId, query: message, limit: 5 }),
    getPersonality(userId),
  ]);

  // Step 4: Thought Engine
  const reasoning = await generateThought({
    userInput: message,
    memories,
    personality,
  });

  // Step 5: Decision Engine — generate final response
  const response = await generateDecision({
    userInput: message,
    emotion,
    memories,
    personality,
    reasoning,
    attachments,
  });

  // Step 6: Save Conversation
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

  // Step 7: Save Memory (current interaction as SHORT_TERM)
  await saveMemory({
    userId,
    content: message.trim(),
    type: "SHORT_TERM",
    importanceScore: emotion.emotion !== "neutral" ? 0.7 : 0.4,
  });

  // Step 8: Self-Evolution — update personality traits
  await evolvePersonality({ userId, emotion });

  // Reload personality after evolution so snapshot reflects updated traits
  const updatedPersonality = await getPersonality(userId);

  // Trigger thread title generation in the background if it's a new thread
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

async function simulateChat(userId, message) {
  const start = Date.now();
  logger.debug({ message: "Simulate chat start", userId });

  const [emotion, memories, personality] = await Promise.all([
    detectEmotion(message),
    retrieveMemory({ userId, query: message, limit: 5 }),
    getPersonality(userId),
  ]);

  const [reasoning, assistantResponse] = await Promise.all([
    generateThought({
      userInput: message,
      memories,
      personality,
    }),
    assistantChain.invoke({
      userInput: message,
    }),
  ]);

  const response = await generateDecision({
    userInput: message,
    emotion,
    memories,
    personality,
    reasoning,
  });

  const duration = Date.now() - start;
  logger.debug({ message: "Simulate chat done", userId, duration });

  return {
    twin: {
      response,
      reasoning,
      emotion,
      personality_snapshot: personality,
    },
    assistant: {
      response: assistantResponse,
    },
  };
}

module.exports = { processChat, getChatHistory, simulateChat };

