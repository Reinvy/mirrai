"use strict";

const { ChatOpenAI } = require("@langchain/openai");

function resolveLlmConfig(overrides = {}) {
  const apiKey = overrides.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY;
  const baseURL =
    overrides.baseURL ?? process.env.OPENAI_API_BASE_URL ?? process.env.OPENAI_BASE_URL;
  const model = overrides.model ?? process.env.OPENAI_MODEL ?? "deepseek-v4-flash";
  const temperature =
    overrides.temperature ??
    (process.env.OPENAI_TEMPERATURE ? parseFloat(process.env.OPENAI_TEMPERATURE) : 0.7);

  const config = {
    apiKey,
    openAIApiKey: apiKey,
    model,
    modelName: model,
    temperature,
  };

  if (baseURL) {
    config.configuration = { baseURL };
  }

  if (overrides.reasoning) {
    config.reasoning = overrides.reasoning;
  }
  if (overrides.reasoningEffort) {
    config.reasoningEffort = overrides.reasoningEffort;
  }

  return config;
}

function getLlm(overrides = {}) {
  return new ChatOpenAI(resolveLlmConfig(overrides));
}

module.exports = { getLlm, resolveLlmConfig };
