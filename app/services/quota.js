"use strict";

const { prisma } = require("../config/db");
const { AppError } = require("../utils/app-error");
const { startOfDay } = require("../utils/date");

// Free tier: 50 chats per day
const FREE_DAILY_LIMIT = 50;
const PRO_DAILY_LIMIT = 1000;

function getLimitForTier(tier) {
  switch ((tier || "free").toLowerCase()) {
    case "pro":
      return PRO_DAILY_LIMIT;
    default:
      return FREE_DAILY_LIMIT;
  }
}

async function getQuotaStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, dailyChatCount: true, dailyCountDate: true },
  });
  if (!user) throw new AppError(404, "User tidak ditemukan");

  const today = startOfDay();
  const lastReset = user.dailyCountDate ? startOfDay(user.dailyCountDate) : null;
  const usedToday =
    lastReset && lastReset.getTime() === today.getTime() ? user.dailyChatCount : 0;

  const limit = getLimitForTier(user.tier);

  return {
    tier: user.tier,
    used: usedToday,
    limit,
    remaining: Math.max(0, limit - usedToday),
    resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Atomically consume one chat from today's quota.
 *
 * The counter and its day stamp move in a single UPDATE, so concurrent requests
 * cannot both observe "49 used" and both pass. The row is only returned when
 * the caller was still under the limit.
 */
async function checkAndIncrementQuota(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  if (!user) throw new AppError(404, "User tidak ditemukan");

  const limit = getLimitForTier(user.tier);
  const today = startOfDay();

  const rows = await prisma.$queryRaw`
    UPDATE "User"
    SET "dailyChatCount" = CASE
          WHEN "dailyCountDate" IS NOT NULL AND "dailyCountDate" >= ${today}
            THEN "dailyChatCount" + 1
          ELSE 1
        END,
        "dailyCountDate" = CASE
          WHEN "dailyCountDate" IS NOT NULL AND "dailyCountDate" >= ${today}
            THEN "dailyCountDate"
          ELSE ${new Date()}
        END
    WHERE id = ${userId}
      AND (
        "dailyCountDate" IS NULL
        OR "dailyCountDate" < ${today}
        OR "dailyChatCount" < ${limit}
      )
    RETURNING "dailyChatCount", "dailyCountDate"
  `;

  if (rows.length === 0) {
    const status = await getQuotaStatus(userId);
    throw new AppError(
      429,
      `Batas harian AI tercapai (${status.used}/${status.limit}). Reset tengah malam waktu lokal. Upgrade ke Pro untuk batas lebih tinggi.`,
    );
  }

  return rows[0];
}

/**
 * Give back one chat consumed today. Used when a request fails before the
 * response was delivered, so an LLM/network error does not burn quota.
 */
async function refundQuota(userId) {
  if (!userId) return;
  const today = startOfDay();
  await prisma.$executeRaw`
    UPDATE "User"
    SET "dailyChatCount" = GREATEST("dailyChatCount" - 1, 0)
    WHERE id = ${userId}
      AND "dailyCountDate" IS NOT NULL
      AND "dailyCountDate" >= ${today}
  `;
}

/**
 * Run `fn` under quota rules: consume a unit unless the user pays via BYOK,
 * and refund it when `fn` throws.
 */
async function withQuotaForUser(userId, byok, fn) {
  const charged = !byok;
  if (charged) {
    await checkAndIncrementQuota(userId);
  }
  try {
    return await fn();
  } catch (err) {
    if (charged) {
      await refundQuota(userId).catch(() => {});
    }
    throw err;
  }
}

async function setUserTier(userId, tier) {
  return prisma.user.update({
    where: { id: userId },
    data: { tier },
    select: { id: true, tier: true },
  });
}

module.exports = {
  getQuotaStatus,
  checkAndIncrementQuota,
  refundQuota,
  withQuotaForUser,
  setUserTier,
  FREE_DAILY_LIMIT,
  PRO_DAILY_LIMIT,
};
