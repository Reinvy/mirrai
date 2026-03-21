"use strict";

const { AppError } = require("../../utils/app-error");

class ChatValidation {
  static validateChat(req, res, next) {
    const { message } = req.body;
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      throw new AppError(400, "Pesan tidak boleh kosong");
    }
    next();
  }
}

module.exports = { ChatValidation };
