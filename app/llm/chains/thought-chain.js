"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { getLlm } = require("../../config/openai");
const { thoughtPrompt } = require("../prompts/thought-prompt");

function buildChain(llm) {
  return thoughtPrompt.pipe(llm).pipe(new StringOutputParser());
}

const thoughtChain = {
  invoke: async (input, { llm } = {}) => buildChain(llm || getLlm()).invoke(input),
};

module.exports = { thoughtChain };
