"use strict";

const { generateRecap, VALID_PERIODS } = require("../../services/recap");
const { getLlmForUser } = require("../../services/llm-resolver");
const { withQuotaForUser } = require("../../services/quota");
const { formatSuccessResponse } = require("../../utils/response-formatter");
const { AppError } = require("../../utils/app-error");

async function recapController(req, res, next) {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    if (!VALID_PERIODS.includes(days)) {
      throw new AppError(400, `days harus salah satu dari: ${VALID_PERIODS.join(", ")}`);
    }
    const { llm, byok } = await getLlmForUser(req.credentials.id);
    const data = await withQuotaForUser(req.credentials.id, byok, () =>
      generateRecap(req.credentials.id, days, { llm }),
    );
    res.status(200).json(formatSuccessResponse({ message: "Recap generated", data }));
  } catch (err) {
    next(err);
  }
}

module.exports = { recapController };
