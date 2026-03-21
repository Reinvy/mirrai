"use strict";

const { emotionChain } = require("../llm/chains/emotion-chain");

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
    return { emotion: "neutral", confidence: 0.5 };
  } catch {
    return { emotion: "neutral", confidence: 0.5 };
  }
}

module.exports = { detectEmotion };
