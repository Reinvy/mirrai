"use strict";

const { AppError } = require("../../utils/app-error");

const MAX_BASE_URL_LEN = 500;
const MAX_API_KEY_LEN = 512;
const MIN_API_KEY_LEN = 8;
const MAX_MODEL_LEN = 100;

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

class ByokValidation {
  static validatePutConfig(req, _res, next) {
    const body = req.body || {};
    const errors = [];

    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      errors.push("enabled harus boolean");
    }

    if (body.baseUrl !== undefined) {
      if (typeof body.baseUrl !== "string") {
        errors.push("baseUrl harus string");
      } else if (body.baseUrl.length === 0) {
        errors.push("baseUrl tidak boleh kosong");
      } else if (body.baseUrl.length > MAX_BASE_URL_LEN) {
        errors.push(`baseUrl terlalu panjang (maks ${MAX_BASE_URL_LEN} karakter)`);
      } else if (!isValidHttpUrl(body.baseUrl)) {
        errors.push("baseUrl harus URL http(s) yang valid");
      }
    }

    if (body.apiKey !== undefined && body.apiKey !== null) {
      if (typeof body.apiKey !== "string") {
        errors.push("apiKey harus string");
      } else if (body.apiKey.length === 0) {
        // allow empty string to clear
      } else if (body.apiKey.length < MIN_API_KEY_LEN) {
        errors.push(`apiKey minimal ${MIN_API_KEY_LEN} karakter`);
      } else if (body.apiKey.length > MAX_API_KEY_LEN) {
        errors.push(`apiKey terlalu panjang (maks ${MAX_API_KEY_LEN} karakter)`);
      }
    }

    if (body.model !== undefined) {
      if (typeof body.model !== "string") {
        errors.push("model harus string");
      } else if (body.model.length === 0) {
        errors.push("model tidak boleh kosong");
      } else if (body.model.length > MAX_MODEL_LEN) {
        errors.push(`model terlalu panjang (maks ${MAX_MODEL_LEN} karakter)`);
      }
    }

    if (body.thinkingEnabled !== undefined && typeof body.thinkingEnabled !== "boolean") {
      errors.push("thinkingEnabled harus boolean");
    }

    if (body.visionEnabled !== undefined && typeof body.visionEnabled !== "boolean") {
      errors.push("visionEnabled harus boolean");
    }

    if (errors.length > 0) {
      return next(new AppError(400, errors.join("; ")));
    }
    next();
  }

  static validateTestConnection(req, _res, next) {
    const { baseUrl, apiKey, model } = req.body || {};
    const errors = [];
    if (!baseUrl || typeof baseUrl !== "string" || !isValidHttpUrl(baseUrl)) {
      errors.push("baseUrl harus URL http(s) yang valid");
    }
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < MIN_API_KEY_LEN) {
      errors.push(`apiKey minimal ${MIN_API_KEY_LEN} karakter`);
    }
    if (!model || typeof model !== "string" || model.length === 0) {
      errors.push("model wajib diisi");
    }
    if (errors.length > 0) {
      return next(new AppError(400, errors.join("; ")));
    }
    next();
  }
}

module.exports = { ByokValidation };
