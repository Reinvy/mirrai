"use strict";

const { getPersonality, updatePersonality } = require("./personality-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

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

module.exports = { getPersonalityController, updatePersonalityController };
