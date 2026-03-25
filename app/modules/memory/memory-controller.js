"use strict";

const { saveMemory, getMemoriesByUser } = require("./memory-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function getMemoriesController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const memories = await getMemoriesByUser(userId);
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
      importanceScore,
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

module.exports = { getMemoriesController, createMemoryController };
