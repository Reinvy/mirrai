"use strict";

const { JsonOutputParser } = require("@langchain/core/output_parsers");
const { getLlm } = require("../../config/openrouter");
const { emotionPrompt } = require("../prompts/emotion-prompt");

let _chain = null;

const emotionChain = {
  invoke: async (input) => {
    if (!_chain) _chain = emotionPrompt.pipe(getLlm()).pipe(new JsonOutputParser());
    return _chain.invoke(input);
  },
};

module.exports = { emotionChain };
