"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { RunnableLambda } = require("@langchain/core/runnables");
const { getLlm } = require("../../config/openai");
const { memoryExtractionPrompt } = require("../prompts/memory-extraction-prompt");
const { parseLlmJson } = require("../json");

const extractJson = RunnableLambda.from((text) => parseLlmJson(text));

function buildChain(llm) {
  return memoryExtractionPrompt.pipe(llm).pipe(new StringOutputParser()).pipe(extractJson);
}

const memoryExtractionChain = {
  invoke: async (input, { llm } = {}) => buildChain(llm || getLlm()).invoke(input),
};

module.exports = { memoryExtractionChain };
