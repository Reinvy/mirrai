"use strict";

const {
  getChatInsights,
  getMemoryInsights,
  getPersonalityInsights,
} = require("../../services/insights");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function chatInsightsController(req, res, next) {
  try {
    const data = await getChatInsights(req.credentials.id);
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Chat insights", data }));
  } catch (err) {
    next(err);
  }
}

async function memoryInsightsController(req, res, next) {
  try {
    const data = await getMemoryInsights(req.credentials.id);
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Memory insights", data }));
  } catch (err) {
    next(err);
  }
}

async function personalityInsightsController(req, res, next) {
  try {
    const data = await getPersonalityInsights(req.credentials.id);
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Personality insights", data }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  chatInsightsController,
  memoryInsightsController,
  personalityInsightsController,
};
