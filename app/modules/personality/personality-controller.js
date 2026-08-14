"use strict";

const { getPersonality } = require("./personality-service");
const { calculateArchetype } = require("./archetype-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function getPersonalityController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const personality = await getPersonality(userId);
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
    const userId = req.credentials.id;
    const data = await calculateArchetype(userId);
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

module.exports = { getPersonalityController, getArchetypeController };
