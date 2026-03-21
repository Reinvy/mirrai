"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { getLlm } = require("../../config/openrouter");
const { thoughtPrompt } = require("../prompts/thought-prompt");

let _chain = null;

const thoughtChain = {
  invoke: async (input) => {
    if (!_chain) _chain = thoughtPrompt.pipe(getLlm()).pipe(new StringOutputParser());
    return _chain.invoke(input);
  },
};

module.exports = { thoughtChain };
