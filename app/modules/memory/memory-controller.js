"use strict";

const {
  saveMemory,
  getMemoriesByUser,
  updateMemory,
  deleteMemory,
  retrieveMemory,
} = require("./memory-service");
const { getMemoryInsights } = require("../../services/insights");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function getMemoriesController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { query } = req.query;

    let memories;
    if (query) {
      memories = await retrieveMemory({ userId, query: query.trim(), limit: 20 });
    } else {
      memories = await getMemoriesByUser(userId);
    }

    res
      .status(200)
      .json(
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
    const { content, type, importanceScore } = req.body;
    const memory = await saveMemory({
      userId,
      content: content.trim(),
      type,
      importanceScore: importanceScore !== undefined ? Number(importanceScore) : 0.5,
    });
    res
      .status(201)
      .json(
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
    const { memoryId } = req.params;
    const { content, type, importanceScore } = req.body;

    const memory = await updateMemory(memoryId, userId, {
      content,
      type,
      importanceScore,
    });

    res
      .status(200)
      .json(
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
    const { memoryId } = req.params;

    await deleteMemory(memoryId, userId);

    res
      .status(200)
      .json(
        formatSuccessResponse({
          message: "Memory berhasil dihapus",
        }),
      );
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

module.exports = {
  getMemoriesController,
  createMemoryController,
  updateMemoryController,
  deleteMemoryController,
  memoryInsightsController,
};
