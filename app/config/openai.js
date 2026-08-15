"use strict";

const { ChatOpenAI } = require("@langchain/openai");

function resolveLlmConfig(overrides = {}) {
  const apiKey =
    overrides.apiKey ??
    process.env.OPENAI_API_KEY ??
    process.env.OPENROUTER_API_KEY ??
    "default-key";
  const baseURL =
    overrides.baseURL ??
    process.env.OPENAI_API_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    process.env.OPENROUTER_BASE_URL;
  const model = overrides.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const temperature =
    overrides.temperature ??
    (process.env.OPENAI_TEMPERATURE ? parseFloat(process.env.OPENAI_TEMPERATURE) : 0.7);

  const defaultHeaders = {
    "HTTP-Referer": process.env.APP_URL ?? "https://mirrai.app",
    "X-Title": "MirrAI",
    ...(overrides.headers || {}),
  };

  const config = {
    apiKey,
    openAIApiKey: apiKey,
    model,
    modelName: model,
    temperature,
    configuration: {
      defaultHeaders,
      ...(baseURL ? { baseURL } : {}),
      ...(overrides.configuration || {}),
    },
  };

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

