"use strict";

const { thoughtChain } = require("../llm/chains/thought-chain");
const {
  formatPersonality,
  formatMemories,
  formatProfile,
  formatThreadContext,
} = require("../llm/format");

async function generateThought({ userInput, memories, personality, profile, threadContext }) {
  try {
    const name = (profile?.name || "User").toString().trim() || "User";
    const reasoning = await thoughtChain.invoke({
      userInput,
      name,
      profile: formatProfile(profile || {}),
      personality: formatPersonality(personality),
      memories: formatMemories(memories),
      threadContext: formatThreadContext(threadContext || []),
    });
    return reasoning;
  } catch {
    return "Memikirkan respons yang tepat...";
  }
}

module.exports = { generateThought };
