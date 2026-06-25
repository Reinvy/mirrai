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

let _chain = null;

const memoryExtractionChain = {
  invoke: async (input) => {
    if (!_chain) {
      _chain = memoryExtractionPrompt
        .pipe(getLlm())
        .pipe(new StringOutputParser())
        .pipe(extractJson);
    }
    return _chain.invoke(input);
  },
};

module.exports = { memoryExtractionChain };
