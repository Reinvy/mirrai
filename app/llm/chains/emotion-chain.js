"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { RunnableLambda } = require("@langchain/core/runnables");
const { getLlm } = require("../../config/openai");
const { emotionPrompt } = require("../prompts/emotion-prompt");

// Extracts first JSON object from a string, handling markdown code fence wrappers
const extractJson = RunnableLambda.from((text) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object found in LLM output: ${text}`);
  return JSON.parse(match[0]);
});

function buildChain(llm) {
  return emotionPrompt.pipe(llm).pipe(new StringOutputParser()).pipe(extractJson);
}

const emotionChain = {
  invoke: async (input, { llm } = {}) => buildChain(llm || getLlm()).invoke(input),
};

module.exports = { emotionChain };
