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

  static validateUpdate(req, res, next) {
    const { content, type, importanceScore } = req.body;

    if (content !== undefined) {
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new AppError(400, "Konten memory tidak boleh kosong jika disediakan");
      }
    }

    if (type !== undefined) {
      if (!VALID_MEMORY_TYPES.includes(type)) {
        throw new AppError(
          400,
          `Tipe memory tidak valid. Pilihan: ${VALID_MEMORY_TYPES.join(", ")}`,
        );
      }
    }

    if (importanceScore !== undefined) {
      const score = Number(importanceScore);
      if (isNaN(score) || score < 0 || score > 1) {
        throw new AppError(
          400,
          "importanceScore harus berupa angka antara 0.0 dan 1.0",
        );
      }
    }

    next();
  }
}

module.exports = { MemoryValidation };
