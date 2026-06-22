"use strict";

const { prisma } = require("../../config/db");
const { getEmbeddings } = require("../../config/embedding");

async function saveMemory({ userId, content, type, importanceScore = 0.5 }) {
  // Create memory record
  const memory = await prisma.memory.create({
    data: { userId, content, type, importanceScore },
  });

  // Generate and save embedding asynchronously (fire-and-forget in prod, awaited here for data integrity)
  try {
    const [vector] = await getEmbeddings().embedDocuments([content]);
    const vectorStr = `[${vector.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Memory"
      SET embedding = ${vectorStr}::vector
      WHERE id = ${memory.id}
    `;
  } catch {
    // Embedding failure is non-fatal â€” memory is saved without vector
  }

  return memory;
}

async function retrieveMemory({ userId, query, limit = 5 }) {
  // If no query, return recent memories by importance
  if (!query) {
    return prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        content: true,
        type: true,
        importanceScore: true,
        createdAt: true,
      },
    });
  }

  try {
    const [queryVector] = await getEmbeddings().embedDocuments([query]);
    const vectorStr = `[${queryVector.join(",")}]`;

    const memories = await prisma.$queryRaw`
      SELECT id, content, type, "importanceScore", "createdAt"
      FROM "Memory"
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;
    return memories;
  } catch {
    // Fallback to recency-based retrieval if vector search fails
    return prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        content: true,
        type: true,
        importanceScore: true,
        createdAt: true,
      },
    });
  }
}

async function getMemoriesByUser(userId) {
  return prisma.memory.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      content: true,
      type: true,
      importanceScore: true,
      createdAt: true,
    },
  });
}

async function updateMemory(memoryId, userId, { content, type, importanceScore }) {
  const data = { type };
  if (importanceScore !== undefined) data.importanceScore = importanceScore;
  if (content !== undefined) data.content = content.trim();

  const updated = await prisma.memory.update({
    where: { id: memoryId, userId },
    data,
  });

  if (content !== undefined) {
    try {
      const [vector] = await getEmbeddings().embedDocuments([content.trim()]);
      const vectorStr = `[${vector.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "Memory"
        SET embedding = ${vectorStr}::vector
        WHERE id = ${memoryId}
      `;
    } catch (err) {
      // Abaikan kegagalan embedding non-fatal
    }
  }

  return updated;
}

async function deleteMemory(memoryId, userId) {
  return prisma.memory.update({
    where: { id: memoryId, userId },
    data: { deletedAt: new Date() },
  });
}

module.exports = {
  saveMemory,
  retrieveMemory,
  getMemoriesByUser,
  updateMemory,
  deleteMemory,
};
