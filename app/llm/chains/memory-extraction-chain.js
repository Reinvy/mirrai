"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { RunnableLambda } = require("@langchain/core/runnables");
const { getLlm } = require("../../config/openai");
const { memoryExtractionPrompt } = require("../prompts/memory-extraction-prompt");

const extractJson = RunnableLambda.from((text) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object found in LLM output: ${text}`);
  return JSON.parse(match[0]);
});

function buildChain(llm) {
  return memoryExtractionPrompt.pipe(llm).pipe(new StringOutputParser()).pipe(extractJson);
}

const memoryExtractionChain = {
  invoke: async (input, { llm } = {}) => buildChain(llm || getLlm()).invoke(input),
};

module.exports = { memoryExtractionChain };
