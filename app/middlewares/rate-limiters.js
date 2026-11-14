"use strict";

const rateLimit = require("express-rate-limit");

const TOO_MANY_GENERIC = {
  status: "error",
  message: "Terlalu banyak request. Coba lagi sebentar lagi.",
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
  },
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_MANY_GENERIC,
});

/**
 * Read limiters are created per mounted router: a shared instance would make
 * `GET /api/memory/me` and `GET /api/chat/threads` consume the same budget.
 */
function createReadLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: TOO_MANY_GENERIC,
  });
}

const readLimiter = createReadLimiter();

const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Terlalu banyak request. Coba lagi dalam beberapa saat.",
  },
});

const threadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_MANY_GENERIC,
});

module.exports = {
  authLimiter,
  writeLimiter,
  readLimiter,
  createReadLimiter,
  chatRateLimiter,
  threadRateLimiter,
};
