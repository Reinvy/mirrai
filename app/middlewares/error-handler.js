"use strict";

const { AppError } = require("../utils/app-error");
const { logger } = require("../config/logger");

const PRISMA_ERROR_MAP = {
  P2002: { status: 409, message: "Data sudah ada (duplikat)" },
  P2025: { status: 404, message: "Data tidak ditemukan" },
  P2003: { status: 400, message: "Referensi data tidak valid" },
};

function errorHandler(err, req, res, next) {
  logger.error({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma known errors
  if (err.code && PRISMA_ERROR_MAP[err.code]) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    return res
      .status(mapped.status)
      .json({ status: "error", message: mapped.message });
  }

  // Operational errors from AppError
  if (err instanceof AppError && err.isOperational) {
    return res
      .status(err.statusCode)
      .json({ status: "error", message: err.message });
  }

  // Unexpected errors — don't leak details in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Terjadi kesalahan pada server"
      : err.message;

  return res.status(500).json({ status: "error", message });
}

module.exports = { errorHandler };
