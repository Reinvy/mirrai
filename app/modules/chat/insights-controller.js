"use strict";

const {
  getChatInsights,
  getMemoryInsights,
  getPersonalityInsights,
  getMoodTimeline,
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

async function moodTimelineController(req, res, next) {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
    const data = await getMoodTimeline(req.credentials.id, days);
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Mood timeline", data }));
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
  moodTimelineController,
};
