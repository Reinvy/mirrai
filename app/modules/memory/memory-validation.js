"use strict";

const { AppError } = require("../../utils/app-error");

const VALID_MEMORY_TYPES = ["SHORT_TERM", "LONG_TERM", "SEMANTIC", "EMOTIONAL"];

class MemoryValidation {
  static validateCreate(req, res, next) {
    const { content, type } = req.body;
    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      throw new AppError(400, "Konten memory harus diisi");
    }
    if (!type || !VALID_MEMORY_TYPES.includes(type)) {
      throw new AppError(
        400,
        `Tipe memory tidak valid. Pilihan: ${VALID_MEMORY_TYPES.join(", ")}`,
      );
    }
    next();
  }
}

module.exports = { MemoryValidation };
