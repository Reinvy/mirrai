"use strict";

const { prisma } = require("../../config/db");
const { getLlm } = require("../../config/openai");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { logger } = require("../../config/logger");
const { AppError } = require("../../utils/app-error");

const MAX_THREAD_TITLE_LEN = 100;

async function createThread(userId, title = "Percakapan Baru") {
  const cleanTitle = (title || "Percakapan Baru").toString().trim();
  if (cleanTitle.length === 0) {
    throw new AppError(400, "Judul thread tidak boleh kosong");
  }
  if (cleanTitle.length > MAX_THREAD_TITLE_LEN) {
    throw new AppError(400, `Judul thread terlalu panjang (maks ${MAX_THREAD_TITLE_LEN} karakter)`);
  }
  return await prisma.thread.create({
    data: {
      userId,
      title: cleanTitle,
    },
  });
}

async function getThreadsByUser(userId) {
  return await prisma.thread.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function updateThread(threadId, userId, { title }) {
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw new AppError(400, "Judul thread tidak boleh kosong");
  }
  if (title.length > MAX_THREAD_TITLE_LEN) {
    throw new AppError(400, `Judul thread terlalu panjang (maks ${MAX_THREAD_TITLE_LEN} karakter)`);
  }

  // Verify ownership
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      userId,
      deletedAt: null,
    },
  });

  if (!thread) {
    throw new AppError(404, "Thread tidak ditemukan");
  }

  return await prisma.thread.update({
    where: { id: threadId },
    data: { title: title.trim() },
  });
}

async function deleteThread(threadId, userId) {
  // Verify ownership
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      userId,
      deletedAt: null,
    },
  });

  if (!thread) {
    throw new AppError(404, "Thread tidak ditemukan");
  }

  const now = new Date();

  // Perform soft delete on thread and its conversations in a transaction
  return await prisma.$transaction(async (tx) => {
    const updatedThread = await tx.thread.update({
      where: { id: threadId },
      data: { deletedAt: now },
    });

    await tx.conversation.updateMany({
      where: {
        threadId,
        deletedAt: null,
      },
      data: { deletedAt: now },
    });

    return updatedThread;
  });
}

async function generateThreadTitle(threadId, userId) {
  try {
    // Fetch the thread and its first 2 conversations
    const conversations = await prisma.conversation.findMany({
      where: {
        threadId,
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 2,
    });

    if (conversations.length === 0) {
      return;
    }

    const firstMsg = conversations[0].message;
    const combinedMessages = conversations.map(c => `User: ${c.message}\nRespon: ${c.response}`).join("\n\n");

    let title = "";

    try {
      const llm = getLlm();
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          "Buat judul singkat (2 sampai 4 kata saja) dalam Bahasa Indonesia untuk topik percakapan berikut. Jawab HANYA dengan judulnya saja, tanpa tanda kutip, tanpa tanda baca akhir seperti titik, dan tanpa kalimat penjelasan tambahan.",
        ],
        ["human", "Percakapan:\n{conversation}"],
      ]);

      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      const res = await chain.invoke({ conversation: combinedMessages });
      title = res.replace(/["']/g, "").trim();
    } catch (llmError) {
      logger.error({ message: "Failed to generate title using LLM", error: llmError.message });
      // Fallback
      title = firstMsg.length > 25 ? firstMsg.substring(0, 25) + "..." : firstMsg;
    }

    if (title) {
      await prisma.thread.update({
        where: { id: threadId },
        data: { title },
      });
      logger.debug({ message: "Thread title generated successfully", threadId, title });
    }
  } catch (error) {
    logger.error({ message: "Error in generateThreadTitle", error: error.message });
  }
}

module.exports = {
  createThread,
  getThreadsByUser,
  updateThread,
  deleteThread,
  generateThreadTitle,
};
