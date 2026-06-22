"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { getLlm } = require("../../config/openai");
const { chatPrompt } = require("../prompts/chat-prompt");

let _chain = null;

const chatChain = {
  invoke: async (input) => {
    if (!_chain) _chain = chatPrompt.pipe(getLlm()).pipe(new StringOutputParser());
    return _chain.invoke(input);
  },
};

module.exports = { chatChain };
