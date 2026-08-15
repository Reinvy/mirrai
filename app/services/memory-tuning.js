"use strict";

const { prisma } = require("../config/db");
const { logger } = require("../config/logger");

const DECAY = 0.05;
const BOOST = 0.05;
const MIN_SCORE = 0.1;
const MAX_SCORE = 1.0;
const STALE_DAYS = 30;

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

async function tuneMemoryImportanceForUser(userId) {
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 86400000);
  const now = new Date();

  // 1. Decay: memories not used in 30 days
  const stale = await prisma.memory.findMany({
    where: {
      userId,
      deletedAt: null,
      importanceScore: { gt: MIN_SCORE },
      OR: [
        { lastUsedAt: { lt: staleThreshold } },
        { lastUsedAt: null, createdAt: { lt: staleThreshold } },
      ],
    },
    select: { id: true, importanceScore: true },
  });

  let decayed = 0;
  for (const m of stale) {
    const newScore = clamp(m.importanceScore - DECAY, MIN_SCORE, MAX_SCORE);
    if (newScore !== m.importanceScore) {
      await prisma.memory.update({
        where: { id: m.id },
        data: { importanceScore: newScore },
      });
      decayed++;
    }
  }

  return { userId, decayed, scanned: stale.length, ts: now.toISOString() };
}

async function bumpMemoryUsage(memoryIds) {
  if (!Array.isArray(memoryIds) || memoryIds.length === 0) return;
  // Bump lastUsedAt to now
  await prisma.memory.updateMany({
    where: { id: { in: memoryIds }, deletedAt: null },
    data: { lastUsedAt: new Date() },
  });
}

let intervalHandle = null;

function startMemoryTuningJob(intervalMs = 7 * 86400000) {
  if (intervalHandle) return;
  if (process.env.NODE_ENV === "test") return;

  const run = async () => {
    try {
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      for (const u of users) {
        const result = await tuneMemoryImportanceForUser(u.id);
        if (result.decayed > 0) {
          logger.debug({
            message: "Memory auto-tune",
            ...result,
          });
        }
      }
    } catch (err) {
      logger.error({
        message: "Memory tuning job failed",
        error: err.message,
      });
    }
  };

  // Run once on startup (delayed 30s) then on interval
  setTimeout(run, 30 * 1000);
  intervalHandle = setInterval(run, intervalMs);
  logger.info({
    message: "Memory auto-tune job started",
    intervalMs,
  });
}

function stopMemoryTuningJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  tuneMemoryImportanceForUser,
  bumpMemoryUsage,
  startMemoryTuningJob,
  stopMemoryTuningJob,
};
