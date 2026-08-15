"use strict";

const { getQuotaStatus, setUserTier } = require("../../services/quota");
const { formatSuccessResponse } = require("../../utils/response-formatter");
const { AppError } = require("../../utils/app-error");

async function getMyQuotaController(req, res, next) {
  try {
    const data = await getQuotaStatus(req.credentials.id);
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Quota status", data }));
  } catch (err) {
    next(err);
  }
}

async function upgradeToProController(req, res, next) {
  try {
    // Stub: in production, integrate Stripe / Paddle / Lemonsqueezy
    // For now, this is a no-op that just sets tier. Real payment integration
    // is a separate stage.
    const updated = await setUserTier(req.credentials.id, "pro");
    res
      .status(200)
      .json(
        formatSuccessResponse({
          message:
            "Upgraded to Pro (dev mode). Production: integrate payment provider first.",
          data: updated,
        }),
      );
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyQuotaController, upgradeToProController };
