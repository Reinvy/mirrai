"use strict";

const jwt = require("jsonwebtoken");
const { prisma } = require("../config/db");
const { logger } = require("../config/logger");

async function cleanupExpiredTokens() {
  try {
    const blacklisted = await prisma.tokenBlacklist.findMany();
    const expiredTokens = [];

    for (const entry of blacklisted) {
      try {
        const decoded = jwt.decode(entry.token);
        if (decoded && decoded.exp && decoded.exp * 1000 < Date.now()) {
          expiredTokens.push(entry.token);
        }
      } catch {
        // Jika token tidak valid / corrupt, kita bisa bersihkan juga untuk mencegah kebocoran penyimpanan
        expiredTokens.push(entry.token);
      }
    }

    if (expiredTokens.length > 0) {
      await prisma.tokenBlacklist.deleteMany({
        where: {
          token: { in: expiredTokens },
        },
      });
      logger.info({
        message: "Cleaned up expired tokens from blacklist",
        count: expiredTokens.length,
      });
    }
  } catch (err) {
    logger.warn({
      message: "Token blacklist cleanup failed",
      error: err.message,
    });
  }
}

function startTokenCleanupJob(intervalMs = 3600000) { // Default 1 jam
  if (process.env.NODE_ENV === "test") return;

  // Jalankan segera saat startup aplikasi
  cleanupExpiredTokens();
  // Jadwalkan untuk dijalankan berkala
  setInterval(cleanupExpiredTokens, intervalMs);
}

module.exports = { startTokenCleanupJob };
