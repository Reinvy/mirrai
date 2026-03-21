"use strict";

const { chatChain } = require("../llm/chains/chat-chain");

function formatPersonality(personality) {
  return Object.entries(personality)
    .filter(([k]) =>
      ["empathy", "logic", "humor", "confidence", "playfulness"].includes(k),
    )
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
    .join(", ");
}

function formatMemories(memories) {
  if (!memories || memories.length === 0) return "Belum ada memory relevan";
  return memories
    .map((m, i) => `${i + 1}. [${m.type}] ${m.content}`)
    .join("\n");
}

async function generateDecision({
  userInput,
  emotion,
  memories,
  personality,
  reasoning,
}) {
  const response = await chatChain.invoke({
    userInput,
    emotion: `${emotion.emotion} (confidence: ${emotion.confidence})`,
    personality: formatPersonality(personality),
    memories: formatMemories(memories),
    reasoning,
  });
  return response;
}

module.exports = { generateDecision };
