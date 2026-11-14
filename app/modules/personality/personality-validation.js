"use strict";

const { AppError } = require("../../utils/app-error");

const TRAITS = ["empathy", "logic", "humor", "confidence", "playfulness"];
const MIN_TRAIT = 0.1;
const MAX_TRAIT = 1.0;

class PersonalityValidation {
  static validateUpdate(req, res, next) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AppError(400, "Body harus berupa objek trait personality");
    }

    let provided = 0;
    for (const trait of TRAITS) {
      if (body[trait] === undefined) continue;
      const value = body[trait];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < MIN_TRAIT ||
        value > MAX_TRAIT
      ) {
        throw new AppError(
          400,
          `Nilai ${trait} harus berupa angka ${MIN_TRAIT}-${MAX_TRAIT}`,
        );
      }
      provided += 1;
    }

    if (provided === 0) {
      throw new AppError(
        400,
        `Minimal satu trait harus diisi: ${TRAITS.join(", ")}`,
      );
    }

    next();
  }
}

module.exports = { PersonalityValidation, TRAITS };
