"use strict";

const { emotionChain } = require("../llm/chains/emotion-chain");
const { logger } = require("../config/logger");

async function detectEmotion(userInput) {
  try {
    const result = await emotionChain.invoke({ userInput });
    if (
      result &&
      typeof result.emotion === "string" &&
      typeof result.confidence === "number"
    ) {
      return { emotion: result.emotion, confidence: result.confidence };
    }
    logger.warn({ message: "Emotion chain returned unexpected shape", result });
    return { emotion: "neutral", confidence: 0.5 };
  } catch (err) {
    logger.warn({ message: "Emotion detection failed, using neutral fallback", error: err.message });
    return { emotion: "neutral", confidence: 0.5 };
  }
}

module.exports = { detectEmotion };
