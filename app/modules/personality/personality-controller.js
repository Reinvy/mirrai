"use strict";

const { getPersonality, updatePersonality, getPersonalityHistory } = require("./personality-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");
const { AppError } = require("../../utils/app-error");

async function getPersonalityController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const personality = await getPersonality(userId);
    res
      .status(200)
      .json(
        formatSuccessResponse({
          message: "Personality berhasil diambil",
          data: personality,
        }),
      );
  } catch (err) {
    next(err);
  }
}

async function updatePersonalityController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const updated = await updatePersonality(userId, req.body);
    res
      .status(200)
      .json(
        formatSuccessResponse({
          message: "Personality berhasil diperbarui",
          data: updated,
        }),
      );
  } catch (err) {
    next(err);
  }
}

async function getPersonalityHistoryController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const { from, to } = req.query;
    if (from && isNaN(Date.parse(from))) {
      throw new AppError(400, "Parameter 'from' harus tanggal valid (ISO 8601)");
    }
    if (to && isNaN(Date.parse(to))) {
      throw new AppError(400, "Parameter 'to' harus tanggal valid (ISO 8601)");
    }
    const history = await getPersonalityHistory(userId, { limit, from, to });
    res
      .status(200)
      .json(
        formatSuccessResponse({
          message: "Riwayat kepribadian berhasil diambil",
          data: history,
        }),
      );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPersonalityController,
  updatePersonalityController,
  getPersonalityHistoryController,
};
