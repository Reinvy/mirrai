"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { swaggerSpec } = require("./app/config/openapi");
const { apiReference } = require("@scalar/express-api-reference");
const { errorHandler } = require("./app/middlewares/error-handler");
const {
  authLimiter,
  writeLimiter,
  createReadLimiter,
} = require("./app/middlewares/rate-limiters");
const { AppError } = require("./app/utils/app-error");
const { assertCryptoConfig } = require("./app/utils/crypto");
const { startTokenCleanupJob } = require("./app/services/token-cleanup-service");
const { startMemoryTuningJob } = require("./app/services/memory-tuning");

// Module routers
const authRouter = require("./app/modules/auth/auth-router");
const memoryRouter = require("./app/modules/memory/memory-router");
const personalityRouter = require("./app/modules/personality/personality-router");
const chatRouter = require("./app/modules/chat/chat-router");
const simulationRouter = require("./app/modules/simulation/simulation-router");
const dreamRouter = require("./app/modules/dream/dream-router");
const byokRouter = require("./app/modules/byok/byok-router");

assertCryptoConfig();

const app = express();

// Behind N proxies (0 = direct). Required for correct client IPs in limiters.
app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// Security & CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin / server-to-server requests have no Origin header.
      if (!origin) return callback(null, true);
      callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  }),
);
app.use(
  helmet({
    // CSP is intentionally omitted: this is a JSON API server, not an HTML
    // document. CSP on JSON responses is a no-op for security but surfaces as
    // a `script-src 'unsafe-eval'` warning in the frontend's DevTools "Issues"
    // panel because Chrome aggregates CSP across same-origin responses. The
    // frontend (Next.js) is responsible for setting its own CSP if needed.
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

// Credential endpoints get the strict limiter; the rest of /api/auth (e.g.
// /me) must not be throttled by a shared 20-per-15-minutes budget.
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// API routes
app.use("/api/auth", authRouter);
app.use("/api/memory", createReadLimiter(), memoryRouter);
app.use("/api/personality", createReadLimiter(), personalityRouter);
app.use("/api/chat", chatRouter); // chat-router applies its own per-route limiter
app.use("/api/simulation", writeLimiter, simulationRouter);
app.use("/api/dream", writeLimiter, dreamRouter);
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
