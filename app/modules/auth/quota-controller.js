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
    // Self-service upgrade has no payment provider behind it. Only expose it
    // outside production, or when explicitly enabled.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ENABLE_DEV_UPGRADE !== "true"
    ) {
      throw new AppError(
        403,
        "Upgrade mandiri dinonaktifkan. Hubungi admin untuk berlangganan Pro.",
      );
    }
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
