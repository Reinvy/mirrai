"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { swaggerSpec } = require("./app/config/openapi");
const { apiReference } = require("@scalar/express-api-reference");
const { errorHandler } = require("./app/middlewares/error-handler");
const { AppError } = require("./app/utils/app-error");
const { startTokenCleanupJob } = require("./app/services/token-cleanup-service");
const { startMemoryTuningJob } = require("./app/services/memory-tuning");

// Module routers
const authRouter = require("./app/modules/auth/auth-router");
const memoryRouter = require("./app/modules/memory/memory-router");
const personalityRouter = require("./app/modules/personality/personality-router");
const chatRouter = require("./app/modules/chat/chat-router");
const byokRouter = require("./app/modules/byok/byok-router");

const app = express();

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
  message: {
    status: "error",
    message: "Terlalu banyak request. Coba lagi sebentar lagi.",
  },
});
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Terlalu banyak request. Coba lagi sebentar lagi.",
  },
});

// Security & CORS
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ?? "http://localhost:3000"
).split(",");
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        fontSrc: ["'self'", "data:", "https:"],
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
  }),
);

// Logging & parsing
app.use(morgan("dev"));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false, limit: "25mb" }));

// API routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/memory", readLimiter, memoryRouter);
app.use("/api/personality", readLimiter, personalityRouter);
app.use("/api/chat", chatRouter); // chat-router applies its own per-route limiter
app.use("/api/byok", writeLimiter, byokRouter); // tokenVerify applied inside router

// API docs
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
app.use(
  "/docs",
  apiReference({
    spec: { url: "/api-docs.json" },
    pageTitle: "MirrAI API Docs",
  }),
);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(404, `Route ${req.method} ${req.path} tidak ditemukan`));
});

// Global error handler (must be last)
app.use(errorHandler);

// Start periodic token blacklist cleanup
startTokenCleanupJob();

// Start periodic memory importance tuning
startMemoryTuningJob();

module.exports = app;
