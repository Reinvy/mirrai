"use strict";

const { prisma } = require("../../config/db");
const { AppError } = require("../../utils/app-error");

async function getPersonality(userId) {
  const personality = await prisma.personality.findUnique({
    where: { userId },
  });
  if (!personality) {
    throw new AppError(404, "Personality tidak ditemukan untuk user ini");
  }
  return personality;
}

async function initPersonality(userId) {
  const personality = await prisma.personality.create({
    data: {
      userId,
      empathy: 0.5,
      logic: 0.5,
      humor: 0.5,
      confidence: 0.5,
      playfulness: 0.5,
    },
  });
  await savePersonalitySnapshot(userId, personality);
  return personality;
}

function clamp(val, min = 0.1, max = 1.0) {
  return Math.min(Math.max(val, min), max);
}

async function updatePersonality(userId, updates) {
  const allowed = ["empathy", "logic", "humor", "confidence", "playfulness"];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      data[key] = clamp(Number(updates[key]));
    }
  }
  const updated = await prisma.personality.update({ where: { userId }, data });
  await savePersonalitySnapshot(userId, updated);
  return updated;
}

async function savePersonalitySnapshot(userId, traits) {
  return prisma.personalityHistory.create({
    data: {
      userId,
      empathy: traits.empathy,
      logic: traits.logic,
      humor: traits.humor,
      confidence: traits.confidence,
      playfulness: traits.playfulness,
    },
  });
}

async function getPersonalityHistory(userId, { limit = 30 } = {}) {
  const history = await prisma.personalityHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return history.reverse(); // oldest-first for easy plotting
}

module.exports = {
  getPersonality,
  initPersonality,
  updatePersonality,
  savePersonalitySnapshot,
  getPersonalityHistory,
};
