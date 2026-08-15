"use strict";

const {
  getByokStatus,
  setByokConfig,
  disableByok,
  testByokConnection,
} = require("../../services/llm-resolver");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function getByokController(req, res, next) {
  try {
    const data = await getByokStatus(req.credentials.id);
    res.status(200).json(formatSuccessResponse({ message: "BYOK status", data }));
  } catch (err) {
    next(err);
  }
}

async function putByokController(req, res, next) {
  try {
    const { enabled, baseUrl, apiKey, model, thinkingEnabled, visionEnabled } = req.body || {};
    const result = await setByokConfig(req.credentials.id, {
      enabled,
      baseUrl,
      apiKey,
      model,
      thinkingEnabled,
      visionEnabled,
    });
    res.status(200).json(formatSuccessResponse({ message: "BYOK config updated", data: result }));
  } catch (err) {
    next(err);
  }
}

async function deleteByokController(req, res, next) {
  try {
    await disableByok(req.credentials.id);
    res.status(200).json(formatSuccessResponse({ message: "BYOK disabled", data: null }));
  } catch (err) {
    next(err);
  }
}

async function testByokController(req, res, next) {
  try {
    const { baseUrl, apiKey, model } = req.body || {};
    const result = await testByokConnection({ baseUrl, apiKey, model });
    res.status(200).json(formatSuccessResponse({ message: "BYOK test result", data: result }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getByokController,
  putByokController,
  deleteByokController,
  testByokController,
};
