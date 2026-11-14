"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { RunnableLambda } = require("@langchain/core/runnables");
const { getLlm } = require("../../config/openai");
const { emotionPrompt } = require("../prompts/emotion-prompt");
const { parseLlmJson } = require("../json");

const extractJson = RunnableLambda.from((text) => parseLlmJson(text));

function buildChain(llm) {
  return emotionPrompt.pipe(llm).pipe(new StringOutputParser()).pipe(extractJson);
}

const emotionChain = {
  invoke: async (input, { llm } = {}) => buildChain(llm || getLlm()).invoke(input),
};

module.exports = { emotionChain };
