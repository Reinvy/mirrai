"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { getLlm } = require("../../config/openai");
const { chatPrompt } = require("../prompts/chat-prompt");

let _chain = null;
let _modelOnlyChain = null;

function getChain() {
  if (!_chain) {
    _chain = chatPrompt.pipe(getLlm()).pipe(new StringOutputParser());
  }
  return _chain;
}

function getModelOnlyChain() {
  if (!_modelOnlyChain) {
    _modelOnlyChain = chatPrompt.pipe(getLlm());
  }
  return _modelOnlyChain;
}

async function* streamChat(input) {
  let lastText = "";
  const stream = await getChain().stream(input);
  for await (const chunk of stream) {
    if (typeof chunk !== "string") continue;
    const delta = chunk.slice(lastText.length);
    lastText = chunk;
    if (delta) yield delta;
  }
  return lastText;
}

const chatChain = {
  invoke: async (input) => getChain().invoke(input),
  stream: streamChat,
};

module.exports = { chatChain, streamChat, getModelOnlyChain };
