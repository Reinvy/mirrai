"use strict";

const { prepareChatStream, streamPreparedChat } = require("./chat-stream-service");
const { logger } = require("../../config/logger");

const KEEPALIVE_INTERVAL_MS = 15000;

async function chatStreamController(req, res, next) {
  const userId = req.credentials.id;
  const { message, threadId, attachments, persona } = req.body;

  // Preflight: every failure with an HTTP status must surface as JSON, before
  // the response is committed to 200 + text/event-stream.
  let prep;
  try {
    prep = await prepareChatStream(userId, message, threadId, attachments, persona);
  } catch (err) {
    return next(err);
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  res.write(`: connected\n\n`);

  const keepalive = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      // socket already gone
    }
  }, KEEPALIVE_INTERVAL_MS);

  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  };
  res.on("close", onClose);

  try {
    for await (const payload of streamPreparedChat(prep, {
      signal: controller.signal,
    })) {
      if (controller.signal.aborted) break;
      res.write(`data: ${payload}\n\n`);
    }
  } catch (err) {
    logger.error({
      message: "Chat stream controller error",
      userId,
      error: err.message,
    });
    if (!controller.signal.aborted) {
      res.write(
        `data: ${JSON.stringify({ event: "error", message: "Internal error" })}\n\n`,
      );
    }
  } finally {
    clearInterval(keepalive);
    res.off("close", onClose);
    if (!res.writableEnded) {
      res.end();
    }
  }
}

module.exports = { chatStreamController };
