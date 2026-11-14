"use strict";

const { AppError } = require("../utils/app-error");
const { logger } = require("../config/logger");

const PRISMA_ERROR_MAP = {
  P2002: { status: 409, message: "Data sudah ada (duplikat)" },
  P2025: { status: 404, message: "Data tidak ditemukan" },
  P2003: { status: 400, message: "Referensi data tidak valid" },
};

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    // The response already started (e.g. an open SSE stream); let Express
    // close the socket instead of writing a second set of headers.
    return next(err);
  }

  logger.error({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    path: req.path,
    method: req.method,
  });

  if (typeof err.code === "string" && Object.hasOwn(PRISMA_ERROR_MAP, err.code)) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    return res
      .status(mapped.status)
      .json({ status: "error", message: mapped.message });
  }

  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ status: "error", message: "Body JSON tidak valid" });
  }

  if (err.type === "entity.too.large") {
    return res
      .status(413)
      .json({ status: "error", message: "Body terlalu besar" });
  }

  if (err instanceof AppError && err.isOperational) {
    return res
      .status(err.statusCode)
      .json({ status: "error", message: err.message });
  }

  // Errors raised by the LLM provider SDK carry an HTTP status too; they are
  // upstream failures, not invalid client requests.
  if (err?.name === "APIError" || (err?.status >= 400 && Boolean(err?.headers))) {
    return res.status(502).json({
      status: "error",
      message: "Layanan AI sedang bermasalah. Coba lagi sebentar lagi.",
    });
  }

  // Client errors raised by middleware (body parser, CORS, ...); http-errors
  // marks these as exposed, while unexpected 4xx from libraries are not.
  if (
    err?.expose === true &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  ) {
    return res.status(err.status).json({ status: "error", message: err.message });
  }

  const message =
    process.env.NODE_ENV === "production"
      ? "Terjadi kesalahan pada server"
      : err.message;

  return res.status(500).json({ status: "error", message });
}

module.exports = { errorHandler };
