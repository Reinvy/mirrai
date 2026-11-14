"use strict";

const { AppError } = require("../../utils/app-error");

const MIN_SCENARIO_LEN = 10;
const MAX_SCENARIO_LEN = 1000;
const MAX_TITLE_LEN = 100;

function validateTitle(title) {
  if (title === undefined || title === null) return;
  if (typeof title !== "string") {
    throw new AppError(400, "title harus berupa string");
  }
  if (title.length > MAX_TITLE_LEN) {
    throw new AppError(400, `title terlalu panjang (maks ${MAX_TITLE_LEN} karakter)`);
  }
}

function validatePrompt(value, field) {
  if (!value || typeof value !== "string") {
    throw new AppError(400, `${field} wajib diisi`);
  }
  const trimmed = value.trim();
  if (trimmed.length < MIN_SCENARIO_LEN) {
    throw new AppError(400, `${field} minimal ${MIN_SCENARIO_LEN} karakter`);
  }
  if (trimmed.length > MAX_SCENARIO_LEN) {
    throw new AppError(400, `${field} maksimal ${MAX_SCENARIO_LEN} karakter`);
  }
}

class SimulationValidation {
  static validateBranch(req, res, next) {
    const { scenario, title } = req.body || {};
    validatePrompt(scenario, "scenario");
    validateTitle(title);
    next();
  }

  static validateCouncil(req, res, next) {
    const { dilemma, title } = req.body || {};
    validatePrompt(dilemma, "dilemma");
    validateTitle(title);
    next();
  }
}

module.exports = { SimulationValidation, MIN_SCENARIO_LEN, MAX_SCENARIO_LEN };
