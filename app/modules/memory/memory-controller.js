"use strict";

const {
  saveMemory,
  getMemoriesByUser,
  getMemoryGraph,
  deleteMemory,
} = require("./memory-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function getMemoriesController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { category } = req.query;
    const memories = await getMemoriesByUser(userId, category);
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

async function getMemoryGraphController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const graph = await getMemoryGraph(userId);
    res.status(200).json(
      formatSuccessResponse({
        message: "Berhasil mengambil synaptic memory graph",
        data: graph,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function createMemoryController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { content, type, category, importanceScore, emotionalValence } = req.body;
    const memory = await saveMemory({
      userId,
      content: content.trim(),
      type,
      category,
      importanceScore,
      emotionalValence,
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

async function deleteMemoryController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { id } = req.params;
    await deleteMemory(userId, id);
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

module.exports = {
  getMemoriesController,
  getMemoryGraphController,
  createMemoryController,
  deleteMemoryController,
};
