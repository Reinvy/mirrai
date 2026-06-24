"use strict";

const { processChatStream } = require("./chat-stream-service");
const { logger } = require("../../config/logger");

const KEEPALIVE_INTERVAL_MS = 15000;

async function chatStreamController(req, res, next) {
  const userId = req.credentials.id;
  const { message, threadId, attachments } = req.body;

  // SSE headers
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Send an initial comment so clients know the stream is open
  res.write(`: connected\n\n`);

  const keepalive = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      // ignore
    }
  }, KEEPALIVE_INTERVAL_MS);

  // Abort handling: if client disconnects, stop processing
  let aborted = false;
  const onClose = () => {
    aborted = true;
    clearInterval(keepalive);
  };
  req.on("close", onClose);
  req.on("aborted", onClose);

  try {
    for await (const payload of processChatStream(userId, message, threadId, attachments)) {
      if (aborted) break;
      res.write(`data: ${payload}\n\n`);
    }
  } catch (err) {
    logger.error({
      message: "Chat stream controller error",
      userId,
      error: err.message,
    });
    if (!aborted) {
      res.write(
        `data: ${JSON.stringify({ event: "error", message: "Internal error" })}\n\n`,
      );
    }
  } finally {
    clearInterval(keepalive);
    req.off("close", onClose);
    req.off("aborted", onClose);
    if (!aborted) {
      res.end();
    }
  }
}

module.exports = { chatStreamController };
