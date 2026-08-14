"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { ChatValidation } = require("./chat-validation");
const { chatController, chatHistoryController } = require("./chat-controller");
const { streamChatHandler } = require("./chat-stream");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Increased for smooth interaction
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Terlalu banyak request. Coba lagi dalam beberapa saat.",
  },
});

// SSE Streaming chat endpoint
router.post("/stream", tokenVerify, chatRateLimiter, streamChatHandler);
router.get("/stream", tokenVerify, chatRateLimiter, streamChatHandler);

// Standard REST endpoints
router.get(
  "/",
  tokenVerify,
  ChatValidation.validateGetHistory,
  chatHistoryController,
);

router.post(
  "/",
  tokenVerify,
  chatRateLimiter,
  ChatValidation.validateChat,
  chatController,
);

module.exports = router;
