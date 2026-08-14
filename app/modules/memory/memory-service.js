"use strict";

const { prisma } = require("../../config/db");
const { getEmbeddings } = require("../../config/embedding");

const CATEGORY_COLORS = {
  CORE_BELIEF: "#ec4899",
  EXPERIENCE: "#6366f1",
  RELATIONSHIP: "#f59e0b",
  GOAL_FEAR: "#ef4444",
  DAILY_HABIT: "#10b981",
  PHILOSOPHY: "#8b5cf6",
};

async function saveMemory({
  userId,
  content,
  type = "SHORT_TERM",
  category = "EXPERIENCE",
  importanceScore = 0.5,
  emotionalValence = 0.0,
}) {
  const memory = await prisma.memory.create({
    data: {
      userId,
      content,
      type,
      category,
      importanceScore,
      emotionalValence,
    },
  });

  try {
    const [vector] = await getEmbeddings().embedDocuments([content]);
    const vectorStr = `[${vector.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Memory"
      SET embedding = ${vectorStr}::vector
      WHERE id = ${memory.id}
    `;
  } catch {
    // Non-fatal
  }

  return memory;
}

async function retrieveMemory({ userId, query, limit = 5 }) {
  if (!query) {
    return prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        content: true,
        type: true,
        category: true,
        importanceScore: true,
        createdAt: true,
      },
    }).catch(() => []);
  }

  try {
    const [queryVector] = await getEmbeddings().embedDocuments([query]);
    const vectorStr = `[${queryVector.join(",")}]`;

    const memories = await prisma.$queryRaw`
      SELECT id, content, type, category, "importanceScore", "createdAt"
      FROM "Memory"
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;
    return memories;
  } catch {
    return prisma.memory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        content: true,
        type: true,
        category: true,
        importanceScore: true,
        createdAt: true,
      },
    }).catch(() => []);
  }
}

async function getMemoriesByUser(userId, category = null) {
  const where = { userId, deletedAt: null };
  if (category) where.category = category;

  return prisma.memory.findMany({
    where,
    orderBy: [{ importanceScore: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      content: true,
      type: true,
      category: true,
      importanceScore: true,
      createdAt: true,
    },
  }).catch(() => []);
}

async function getMemoryGraph(userId) {
  const memories = await getMemoriesByUser(userId);

  // Transform into Force-Directed Graph nodes and synaptic links
  const nodes = memories.map((m, index) => ({
    id: m.id,
    label: m.content.slice(0, 32) + (m.content.length > 32 ? "..." : ""),
    fullContent: m.content,
    category: m.category || "EXPERIENCE",
    type: m.type,
    importance: m.importanceScore || 0.5,
    val: Math.max(8, Math.round((m.importanceScore || 0.5) * 24)),
    color: CATEGORY_COLORS[m.category] || "#6366f1",
  }));

  // Create intelligent associative links between nodes that share category or high importance
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const sameCat = nodes[i].category === nodes[j].category;
      const highImp = nodes[i].importance > 0.7 && nodes[j].importance > 0.7;
      if (sameCat || (highImp && j === i + 1)) {
        links.push({
          source: nodes[i].id,
          target: nodes[j].id,
          value: sameCat ? 2 : 1,
          color: sameCat ? nodes[i].color : "rgba(255,255,255,0.15)",
        });
      }
    }
  }

  return {
    nodes,
    links,
    stats: {
      totalNodes: nodes.length,
      totalSynapses: links.length,
      categories: Object.keys(CATEGORY_COLORS).map((c) => ({
        category: c,
        count: nodes.filter((n) => n.category === c).length,
        color: CATEGORY_COLORS[c],
      })),
    },
  };
}

async function deleteMemory(userId, memoryId) {
  return prisma.memory.updateMany({
    where: { id: memoryId, userId },
    data: { deletedAt: new Date() },
  });
}

module.exports = {
  saveMemory,
  retrieveMemory,
  getMemoriesByUser,
  getMemoryGraph,
  deleteMemory,
};
