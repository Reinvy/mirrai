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
  static validateGetHistory(req, res, next) {
    const { page, limit } = req.query;
    if (
      page !== undefined &&
      (isNaN(parseInt(page, 10)) || parseInt(page, 10) < 1)
    ) {
      throw new AppError(400, "Parameter page harus berupa angka positif");
    }
    if (
      limit !== undefined &&
      (isNaN(parseInt(limit, 10)) ||
        parseInt(limit, 10) < 1 ||
        parseInt(limit, 10) > 100)
    ) {
      throw new AppError(400, "Parameter limit harus antara 1 dan 100");
    }
    next();
  }
}

module.exports = { ChatValidation };
