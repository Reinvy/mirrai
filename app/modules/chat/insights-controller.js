"use strict";

const {
  getChatInsights,
  getMemoryInsights,
  getMoodTimeline,
} = require("../../services/insights");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function chatInsightsController(req, res, next) {
  try {
    const data = await getChatInsights(req.credentials.id);
    res.status(200).json(formatSuccessResponse({ message: "Chat insights", data }));
  } catch (err) {
    next(err);
  }
}

async function memoryInsightsController(req, res, next) {
  try {
    const data = await getMemoryInsights(req.credentials.id);
    res.status(200).json(formatSuccessResponse({ message: "Memory insights", data }));
  } catch (err) {
    next(err);
  }
}

async function moodTimelineController(req, res, next) {
  try {
    const raw = Number.parseInt(req.query.days, 10);
    const days = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 90) : 30;
    const data = await getMoodTimeline(req.credentials.id, days);
    res.status(200).json(formatSuccessResponse({ message: "Mood timeline", data }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  chatInsightsController,
  memoryInsightsController,
  moodTimelineController,
};
