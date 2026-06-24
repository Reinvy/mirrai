"use strict";

const { processChat, getChatHistory, simulateChat } = require("./chat-service");
const { prisma } = require("../../config/db");
const { formatSuccessResponse } = require("../../utils/response-formatter");
const { AppError } = require("../../utils/app-error");

async function chatController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { message, threadId } = req.body;
    const result = await processChat(userId, message, threadId);
    res.status(200).json(
      formatSuccessResponse({
        message: "Respons berhasil dihasilkan",
        data: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function chatHistoryController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const threadId = req.query.threadId || null;
    const result = await getChatHistory(userId, { page, limit, threadId });
    res.status(200).json(
      formatSuccessResponse({
        message: "Riwayat chat berhasil diambil",
        ...result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function playgroundController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { message } = req.body;
    const result = await simulateChat(userId, message);
    res.status(200).json(
      formatSuccessResponse({
        message: "Simulasi berhasil diselesaikan",
        data: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function getConversationByIdController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { conversationId } = req.params;
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId, deletedAt: null },
    });
    if (!conv) {
      throw new AppError(404, "Percakapan tidak ditemukan");
    }
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Conversation detail", data: conv }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  chatController,
  chatHistoryController,
  playgroundController,
  getConversationByIdController,
};
