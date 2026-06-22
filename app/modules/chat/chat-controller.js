"use strict";

const { processChat, getChatHistory } = require("./chat-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

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

module.exports = { chatController, chatHistoryController };

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
