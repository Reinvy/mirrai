"use strict";

const {
  getPersonality,
  updatePersonality,
  getPersonalityHistory,
  resetPersonality,
  completeOnboarding,
} = require("./personality-service");
const { calculateArchetype } = require("./archetype-service");
const { getPersonalityInsights } = require("../../services/insights");
const { formatSuccessResponse } = require("../../utils/response-formatter");
const { AppError } = require("../../utils/app-error");

async function getPersonalityController(req, res, next) {
  try {
    const personality = await getPersonality(req.credentials.id);
    res.status(200).json(
      formatSuccessResponse({
        message: "Personality berhasil diambil",
        data: personality,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function getArchetypeController(req, res, next) {
  try {
    const data = await calculateArchetype(req.credentials.id);
    res.status(200).json(
      formatSuccessResponse({
        message: "Cognitive DNA & Archetype berhasil dihitung",
        data,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function updatePersonalityController(req, res, next) {
  try {
    const updated = await updatePersonality(req.credentials.id, req.body);
    res.status(200).json(
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
    res.status(200).json(
      formatSuccessResponse({
        message: "Riwayat kepribadian berhasil diambil",
        data: history,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function resetPersonalityController(req, res, next) {
  try {
    const updated = await resetPersonality(req.credentials.id);
    res.status(200).json(
      formatSuccessResponse({
        message: "Personality di-reset ke default",
        data: updated,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function getPersonalityInsightsController(req, res, next) {
  try {
    const includeSummary = req.query.summary === "1";
    const data = await getPersonalityInsights(req.credentials.id, {
      includeSummary,
    });
    res.status(200).json(
      formatSuccessResponse({
        message: "Personality insights",
        data,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function completeOnboardingController(req, res, next) {
  try {
    const data = await completeOnboarding(req.credentials.id);
    res.status(200).json(
      formatSuccessResponse({
        message: "Onboarding selesai",
        data,
      }),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPersonalityController,
  getArchetypeController,
  updatePersonalityController,
  getPersonalityHistoryController,
  resetPersonalityController,
  getPersonalityInsightsController,
  completeOnboardingController,
};
