"use strict";

const { thoughtChain } = require("../llm/chains/thought-chain");

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

async function generateThought({ userInput, memories, personality }) {
  try {
    const reasoning = await thoughtChain.invoke({
      userInput,
      personality: formatPersonality(personality),
      memories: formatMemories(memories),
    });
    return reasoning;
  } catch {
    return "Memikirkan respons yang tepat...";
  }
}

module.exports = { generateThought };
