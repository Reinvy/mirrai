"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { getLlm } = require("../../config/openai");
const { assistantPrompt } = require("../prompts/assistant-prompt");

let _chain = null;

const assistantChain = {
  invoke: async (input) => {
    if (!_chain) {
      _chain = assistantPrompt.pipe(getLlm()).pipe(new StringOutputParser());
    }
    return _chain.invoke(input);
  },
};

module.exports = { assistantChain };
