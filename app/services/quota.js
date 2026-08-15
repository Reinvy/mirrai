"use strict";

const { prisma } = require("../config/db");
const { AppError } = require("../utils/app-error");

// Free tier: 50 chats per day
const FREE_DAILY_LIMIT = 50;
const PRO_DAILY_LIMIT = 1000;

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

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

async function checkAndIncrementQuota(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, dailyChatCount: true, dailyCountDate: true },
  });
  if (!user) throw new AppError(404, "User tidak ditemukan");

  const today = startOfDay();
  const lastReset = user.dailyCountDate
    ? startOfDay(user.dailyCountDate)
    : null;
  const isSameDay = lastReset && lastReset.getTime() === today.getTime();
  const usedToday = isSameDay ? user.dailyChatCount : 0;

  const limit = getLimitForTier(user.tier);
  if (usedToday >= limit) {
    throw new AppError(
      429,
      `Daily chat limit reached (${usedToday}/${limit}). Resets at midnight UTC. Upgrade to Pro for higher limits.`,
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyChatCount: isSameDay ? { increment: 1 } : 1,
      dailyCountDate: new Date(),
    },
  });
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
  setUserTier,
  FREE_DAILY_LIMIT,
  PRO_DAILY_LIMIT,
};
