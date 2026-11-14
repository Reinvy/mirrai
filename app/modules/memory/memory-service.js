"use strict";

const { prisma } = require("../../config/db");
const { getEmbeddings } = require("../../config/embedding");
const { bumpMemoryUsage } = require("../../services/memory-tuning");
const { AppError } = require("../../utils/app-error");
const { logger } = require("../../config/logger");

const CATEGORY_COLORS = {
  CORE_BELIEF: "#ec4899",
  EXPERIENCE: "#6366f1",
  RELATIONSHIP: "#f59e0b",
  GOAL_FEAR: "#ef4444",
  DAILY_HABIT: "#10b981",
  PHILOSOPHY: "#8b5cf6",
};

const MEMORY_TYPES = ["SHORT_TERM", "LONG_TERM", "SEMANTIC", "EMOTIONAL"];
const MEMORY_CATEGORIES = Object.keys(CATEGORY_COLORS);

const LIST_SELECT = {
  id: true,
  content: true,
  type: true,
  category: true,
  importanceScore: true,
  emotionalValence: true,
  associations: true,
  createdAt: true,
};

async function embedAndStore(memoryId, userId, content) {
  const [vector] = await getEmbeddings().embedDocuments([content]);
  const vectorStr = `[${vector.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE "Memory"
    SET embedding = ${vectorStr}::vector
    WHERE id = ${memoryId} AND "userId" = ${userId}
  `;
}

async function clearEmbedding(memoryId, userId) {
  await prisma.$executeRaw`
    UPDATE "Memory"
    SET embedding = NULL
    WHERE id = ${memoryId} AND "userId" = ${userId}
  `;
}

async function saveMemory({
  userId,
  content,
  type = "SHORT_TERM",
  category = "EXPERIENCE",
  importanceScore = 0.5,
  emotionalValence = 0.0,
  associations = [],
}) {
  const normalized = String(content).trim();

  const existing = await prisma.memory.findFirst({
    where: {
      userId,
      deletedAt: null,
      content: { equals: normalized, mode: "insensitive" },
    },
    select: { id: true, importanceScore: true },
  });

  if (existing) {
    return prisma.memory.update({
      where: { id: existing.id },
      data: {
        importanceScore: Math.max(existing.importanceScore, importanceScore),
        lastUsedAt: new Date(),
      },
    });
  }

  const memory = await prisma.memory.create({
    data: {
      userId,
      content: normalized,
      type,
      category,
      importanceScore,
      emotionalValence,
      associations,
    },
  });

  try {
    await embedAndStore(memory.id, userId, normalized);
  } catch (err) {
    logger.warn({
      message: "Embedding failed for memory; saved without vector",
      memoryId: memory.id,
      error: err.message,
    });
  }

  return memory;
}

async function retrieveMemory({ userId, query, limit = 5 }) {
  if (!query) {
    const memories = await prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: LIST_SELECT,
    });
    bumpMemoryUsage(memories.map((m) => m.id)).catch(() => {});
    return memories;
  }

  let memories;
  try {
    const queryVector = await getEmbeddings().embedQuery(query);
    const vectorStr = `[${queryVector.join(",")}]`;

    memories = await prisma.$queryRaw`
      SELECT id, content, type, category, "importanceScore", "createdAt"
      FROM "Memory"
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;
  } catch (err) {
    logger.warn({
      message: "Vector retrieval failed; falling back to recency",
      error: err.message,
    });
    memories = await prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: LIST_SELECT,
    });
  }
  bumpMemoryUsage(memories.map((m) => m.id)).catch(() => {});
  return memories;
}

async function getMemoriesByUser(userId, category = null) {
  const where = { userId, deletedAt: null };
  if (category) where.category = category;

  return prisma.memory.findMany({
    where,
    orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
    select: LIST_SELECT,
  });
}

async function updateMemory(memoryId, userId, patch = {}) {
  const existing = await prisma.memory.findFirst({
    where: { id: memoryId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, "Memory tidak ditemukan");
  }

  const data = {};
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.importanceScore !== undefined) data.importanceScore = Number(patch.importanceScore);
  if (patch.emotionalValence !== undefined) data.emotionalValence = Number(patch.emotionalValence);
  if (patch.associations !== undefined) data.associations = patch.associations;
  if (patch.content !== undefined) data.content = String(patch.content).trim();

  if (Object.keys(data).length === 0) {
    throw new AppError(400, "Tidak ada field yang diubah");
  }

  // Embed before mutating so a failure leaves the old row untouched.
  let newVector = null;
  if (data.content !== undefined) {
    try {
      const [vector] = await getEmbeddings().embedDocuments([data.content]);
      newVector = `[${vector.join(",")}]`;
    } catch (err) {
      logger.warn({
        message: "Embedding failed during memory update",
        memoryId,
        error: err.message,
      });
    }
  }

  const updated = await prisma.memory.update({ where: { id: memoryId }, data });

  if (data.content !== undefined) {
    if (newVector) {
      await prisma.$executeRaw`
        UPDATE "Memory"
        SET embedding = ${newVector}::vector
        WHERE id = ${memoryId} AND "userId" = ${userId}
      `;
    } else {
      await clearEmbedding(memoryId, userId);
    }
  }

  return updated;
}

async function deleteMemory(memoryId, userId) {
  const result = await prisma.memory.updateMany({
    where: { id: memoryId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) {
    throw new AppError(404, "Memory tidak ditemukan");
  }
  return result;
}

module.exports = {
  saveMemory,
  retrieveMemory,
  getMemoriesByUser,
  updateMemory,
  deleteMemory,
  MEMORY_TYPES,
  MEMORY_CATEGORIES,
  CATEGORY_COLORS,
};
