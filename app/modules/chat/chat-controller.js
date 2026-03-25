"use strict";

const { processChat } = require("./chat-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function chatController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { message } = req.body;
    const result = await processChat(userId, message);
    res
      .status(200)
      .json(
        formatSuccessResponse({
          message: "Respons berhasil dihasilkan",
          data: result,
        }),
      );
  } catch (err) {
    next(err);
  }
}

module.exports = { chatController };
