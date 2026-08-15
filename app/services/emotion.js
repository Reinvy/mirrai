"use strict";

const { emotionChain } = require("../llm/chains/emotion-chain");
const { logger } = require("../config/logger");

async function detectEmotion(userInput, { llm } = {}) {
  try {
    const result = await emotionChain.invoke({ userInput }, { llm });
    const conf = Number(result?.confidence);
    if (result?.emotion && typeof result.emotion === "string" && !isNaN(conf)) {
      return { emotion: result.emotion, confidence: conf };
    }
    logger.warn({ message: "Emotion chain returned unexpected shape", result });
    return { emotion: "neutral", confidence: 0.5 };
  } catch (err) {
    logger.warn({
      message: "Emotion detection failed, using neutral fallback",
      error: err.message,
    });
    return { emotion: "neutral", confidence: 0.5 };
  }
}

module.exports = { detectEmotion };
