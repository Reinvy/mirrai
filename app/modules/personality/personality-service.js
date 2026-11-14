"use strict";

const { prisma } = require("../../config/db");
const { AppError } = require("../../utils/app-error");

const TRAITS = ["empathy", "logic", "humor", "confidence", "playfulness"];
const MIN_TRAIT = 0.1;
const MAX_TRAIT = 1.0;

async function getPersonality(userId) {
  const personality = await prisma.personality.findFirst({
    where: { userId, deletedAt: null },
  });
  if (!personality) {
    throw new AppError(404, "Personality tidak ditemukan untuk user ini");
  }
  return personality;
}

function clamp(val, min = MIN_TRAIT, max = MAX_TRAIT) {
  return Math.min(Math.max(val, min), max);
}

async function updatePersonality(userId, updates) {
  const data = {};
  for (const key of TRAITS) {
    if (updates[key] === undefined) continue;
    const value = Number(updates[key]);
    if (!Number.isFinite(value)) {
      throw new AppError(400, `Nilai ${key} harus berupa angka ${MIN_TRAIT}-${MAX_TRAIT}`);
    }
    data[key] = clamp(value);
  }
  if (Object.keys(data).length === 0) {
    throw new AppError(400, "Tidak ada trait yang diubah");
  }

  const updated = await prisma.personality.update({
    where: { userId },
    data,
  });
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

async function getPersonalityHistory(
  userId,
  { limit = 30, from, to } = {},
) {
  const where = { userId, deletedAt: null };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  const history = await prisma.personalityHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return history.reverse(); // oldest-first for easy plotting
}

async function resetPersonality(userId) {
  const defaults = {
    empathy: 0.5,
    logic: 0.5,
    humor: 0.5,
    confidence: 0.5,
    playfulness: 0.5,
  };
  const updated = await prisma.personality.update({
    where: { userId },
    data: defaults,
  });
  await savePersonalitySnapshot(userId, updated);
  return updated;
}

async function completeOnboarding(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
    select: { onboardingCompleted: true },
  });
}

module.exports = {
  getPersonality,
  updatePersonality,
  savePersonalitySnapshot,
  getPersonalityHistory,
  resetPersonality,
  completeOnboarding,
  TRAITS,
};
