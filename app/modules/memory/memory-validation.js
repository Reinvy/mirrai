"use strict";

const { AppError } = require("../../utils/app-error");
const { MEMORY_TYPES, MEMORY_CATEGORIES } = require("./memory-service");

const MAX_CONTENT_LEN = 2000;
const MAX_ASSOCIATIONS = 20;
const MAX_ASSOCIATION_LEN = 60;

function validateAssociations(associations) {
  if (associations === undefined) return;
  if (!Array.isArray(associations)) {
    throw new AppError(400, "associations harus berupa array string");
  }
  if (associations.length > MAX_ASSOCIATIONS) {
    throw new AppError(400, `Maksimal ${MAX_ASSOCIATIONS} asosiasi per memory`);
  }
  for (const item of associations) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AppError(400, "Setiap asosiasi harus berupa string tidak kosong");
    }
    if (item.length > MAX_ASSOCIATION_LEN) {
      throw new AppError(400, `Asosiasi terlalu panjang (maks ${MAX_ASSOCIATION_LEN} karakter)`);
    }
  }
}

function validateNumberField(value, name, min, max) {
  if (value === undefined) return;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new AppError(400, `${name} harus berupa angka antara ${min} dan ${max}`);
  }
}

function validateCategory(category) {
  if (category === undefined) return;
  if (!MEMORY_CATEGORIES.includes(category)) {
    throw new AppError(
      400,
      `Kategori memory tidak valid. Pilihan: ${MEMORY_CATEGORIES.join(", ")}`,
    );
  }
}

function validateType(type, required) {
  if (type === undefined) {
    if (required) {
      throw new AppError(
        400,
        `Tipe memory tidak valid. Pilihan: ${MEMORY_TYPES.join(", ")}`,
      );
    }
    return;
  }
  if (!MEMORY_TYPES.includes(type)) {
    throw new AppError(
      400,
      `Tipe memory tidak valid. Pilihan: ${MEMORY_TYPES.join(", ")}`,
    );
  }
}

class MemoryValidation {
  static validateCreate(req, res, next) {
    const { content, type, importanceScore, emotionalValence, category, associations } =
      req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Konten memory harus diisi");
    }
    if (content.length > MAX_CONTENT_LEN) {
      throw new AppError(400, `Konten memory terlalu panjang (maks ${MAX_CONTENT_LEN} karakter)`);
    }
    validateType(type, true);
    validateCategory(category);
    validateNumberField(importanceScore, "importanceScore", 0, 1);
    validateNumberField(emotionalValence, "emotionalValence", -1, 1);
    validateAssociations(associations);
    next();
  }

  static validateUpdate(req, res, next) {
    const { content, type, importanceScore, emotionalValence, category, associations } =
      req.body;

    if (content !== undefined) {
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new AppError(400, "Konten memory tidak boleh kosong jika disediakan");
      }
      if (content.length > MAX_CONTENT_LEN) {
        throw new AppError(400, `Konten memory terlalu panjang (maks ${MAX_CONTENT_LEN} karakter)`);
      }
    }

    validateType(type, false);
    validateCategory(category);
    validateNumberField(importanceScore, "importanceScore", 0, 1);
    validateNumberField(emotionalValence, "emotionalValence", -1, 1);
    validateAssociations(associations);

    next();
  }
}

module.exports = { MemoryValidation };
