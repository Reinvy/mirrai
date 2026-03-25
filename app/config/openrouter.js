"use strict";

const { ChatOpenRouter } = require("@langchain/openrouter");

let _llm = null;

function getLlm() {
  if (!_llm) {
    _llm = new ChatOpenRouter({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      temperature: 0.7,
    });
  }
  return _llm;
}

module.exports = { getLlm };
