"use strict";

const {
  saveMemory,
  getMemoriesByUser,
  updateMemory,
  deleteMemory,
  retrieveMemory,
} = require("./memory-service");
const {
  getMemoryInsights,
  getMemoryGraph,
} = require("../../services/insights");
const { formatSuccessResponse } = require("../../utils/response-formatter");
const { AppError } = require("../../utils/app-error");

async function getMemoriesController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { category, query } = req.query;

    let memories;
    if (query) {
      memories = await retrieveMemory({ userId, query: query.trim(), limit: 20 });
    } else {
      memories = await getMemoriesByUser(userId, category);
    }

    res.status(200).json(
      formatSuccessResponse({
        message: "Berhasil mengambil memory",
        data: memories,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function createMemoryController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { content, type, category, importanceScore, emotionalValence, associations } =
      req.body;
    const memory = await saveMemory({
      userId,
      content,
      type,
      category,
      importanceScore: importanceScore !== undefined ? Number(importanceScore) : 0.5,
      emotionalValence:
        emotionalValence !== undefined ? Number(emotionalValence) : 0.0,
      associations: associations !== undefined ? associations : [],
    });
    res.status(201).json(
      formatSuccessResponse({
        message: "Memory berhasil disimpan",
        data: memory,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function updateMemoryController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const memoryId = req.params.memoryId;
    const { content, type, importanceScore, category, emotionalValence, associations } =
      req.body;

    const memory = await updateMemory(memoryId, userId, {
      content,
      type,
      importanceScore,
      category,
      emotionalValence,
      associations,
    });

    res.status(200).json(
      formatSuccessResponse({
        message: "Memory berhasil diperbarui",
        data: memory,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function deleteMemoryController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const memoryId = req.params.memoryId;

    await deleteMemory(memoryId, userId);

    res.status(200).json(
      formatSuccessResponse({
        message: "Memory berhasil dihapus",
        data: null,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function memoryInsightsController(req, res, next) {
  try {
    const data = await getMemoryInsights(req.credentials.id);
    res.status(200).json(
      formatSuccessResponse({
        message: "Memory insights",
        data,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function memoryGraphController(req, res, next) {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

    const rawThreshold = Number(req.query.threshold);
    const threshold = Number.isFinite(rawThreshold) ? rawThreshold : 0.75;
    if (threshold < 0.5 || threshold > 0.99) {
      throw new AppError(400, "Parameter threshold harus antara 0.5 dan 0.99");
    }

    const data = await getMemoryGraph(req.credentials.id, {
      limit,
      similarityThreshold: threshold,
    });
    res.status(200).json(
      formatSuccessResponse({
        message: "Memory graph",
        data,
      }),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMemoriesController,
  createMemoryController,
  updateMemoryController,
  deleteMemoryController,
  memoryInsightsController,
  memoryGraphController,
};
