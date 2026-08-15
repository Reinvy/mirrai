"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { getLlm } = require("../../config/openai");
const { assistantPrompt } = require("../prompts/assistant-prompt");

function buildChain(llm) {
  return assistantPrompt.pipe(llm).pipe(new StringOutputParser());
}

const assistantChain = {
  invoke: async (input, { llm } = {}) => buildChain(llm || getLlm()).invoke(input),
};

module.exports = { assistantChain };
