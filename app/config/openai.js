"use strict";

const { ChatOpenAI } = require("@langchain/openai");

let _llm = null;

function getLlm() {
  if (!_llm) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    const baseURL = process.env.OPENAI_API_BASE_URL || process.env.OPENAI_BASE_URL;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const temperature = process.env.OPENAI_TEMPERATURE ? parseFloat(process.env.OPENAI_TEMPERATURE) : 0.7;

    const config = {
      apiKey: apiKey,
      openAIApiKey: apiKey,
      model: model,
      modelName: model,
      temperature: temperature,
    };

    if (baseURL) {
      config.configuration = {
        baseURL: baseURL,
      };
    }

    _llm = new ChatOpenAI(config);
  }
  return _llm;
}

module.exports = { getLlm };
