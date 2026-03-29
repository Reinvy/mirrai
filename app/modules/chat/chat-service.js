"use strict";

const { prisma } = require("../../config/db");
const { detectEmotion } = require("../../services/emotion");
const { generateThought } = require("../../services/thought");
const { generateDecision } = require("../../services/decision");
const { evolvePersonality } = require("../../services/evolution");
const { retrieveMemory, saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { logger } = require("../../config/logger");

async function processChat(userId, message) {
  const start = Date.now();
  logger.debug({ message: "Chat pipeline start", userId });

  // Step 1: Emotion Engine
  const emotion = await detectEmotion(message);

  // Step 2: Memory Retrieval (semantic search)
  const memories = await retrieveMemory({ userId, query: message, limit: 5 });

  // Step 3: Load Personality
  const personality = await getPersonality(userId);

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
  });

  // Step 6: Save Conversation
  await prisma.conversation.create({
    data: { userId, message: message.trim(), response, emotion },
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

  const duration = Date.now() - start;
  logger.debug({ message: "Chat pipeline done", userId, duration });

  return { response, emotion, personality_snapshot: updatedPersonality };
}

async function getChatHistory(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [total, conversations] = await Promise.all([
    prisma.conversation.count({ where: { userId, deletedAt: null } }),
    prisma.conversation.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        message: true,
        response: true,
        emotion: true,
        createdAt: true,
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

module.exports = { processChat, getChatHistory };
