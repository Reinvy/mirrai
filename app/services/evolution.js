"use strict";

const { prisma } = require("../config/db");
const { logger } = require("../config/logger");
const { savePersonalitySnapshot } = require("../modules/personality/personality-service");

// Emotion weight map: how each emotion affects each trait
const EMOTION_WEIGHTS = {
  sad: {
    empathy: 0.05,
    logic: -0.02,
    humor: -0.03,
    confidence: -0.03,
    playfulness: -0.03,
  },
  happy: {
    empathy: 0.02,
    logic: 0.01,
    humor: 0.05,
    confidence: 0.05,
    playfulness: 0.05,
  },
  angry: {
    empathy: -0.03,
    logic: 0.03,
    humor: -0.05,
    confidence: 0.03,
    playfulness: -0.03,
  },
  anxious: {
    empathy: 0.03,
    logic: 0.02,
    humor: -0.03,
    confidence: -0.05,
    playfulness: -0.02,
  },
  excited: {
    empathy: 0.03,
    logic: 0.01,
    humor: 0.04,
    confidence: 0.04,
    playfulness: 0.05,
  },
  confused: {
    empathy: 0.02,
    logic: -0.03,
    humor: -0.01,
    confidence: -0.03,
    playfulness: -0.01,
  },
  lonely: {
    empathy: 0.05,
    logic: -0.01,
    humor: -0.03,
    confidence: -0.04,
    playfulness: -0.02,
  },
  neutral: { empathy: 0, logic: 0, humor: 0, confidence: 0, playfulness: 0 },
};

function clamp(val, min = 0.1, max = 1.0) {
  return Math.min(Math.max(val, min), max);
}

async function evolvePersonality({ userId, emotion }) {
  const personality = await prisma.personality.findUnique({
    where: { userId },
  });
  if (!personality) return null;

  const weights = EMOTION_WEIGHTS[emotion.emotion] ?? EMOTION_WEIGHTS.neutral;
  const factor = emotion.confidence ?? 0.5;

  const updatedData = {
    empathy: clamp(personality.empathy + weights.empathy * factor),
    logic: clamp(personality.logic + weights.logic * factor),
    humor: clamp(personality.humor + weights.humor * factor),
    confidence: clamp(personality.confidence + weights.confidence * factor),
    playfulness: clamp(personality.playfulness + weights.playfulness * factor),
  };

  logger.debug({
    message: "Evolving personality",
    userId,
    emotion: emotion.emotion,
    factor,
    diff: Object.fromEntries(
      Object.entries(updatedData).map(([k, v]) => [
        k,
        +(v - personality[k]).toFixed(4),
      ]),
    ),
  });

  const updated = await prisma.personality.update({
    where: { userId },
    data: updatedData,
  });

  await savePersonalitySnapshot(userId, updated);

  // Bump importanceScore for emotional memories
  const emotionalTypes = ["sad", "angry", "anxious", "lonely"];
  if (emotionalTypes.includes(emotion.emotion)) {
    await prisma.$executeRaw`
      UPDATE "Memory"
      SET "importanceScore" = LEAST("importanceScore" + 0.1, 1.0)
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        AND type = 'EMOTIONAL'::"MemoryType"
    `;
  }

  return updated;
}

module.exports = { evolvePersonality };
