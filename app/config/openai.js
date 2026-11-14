"use strict";

const { ChatOpenAI } = require("@langchain/openai");

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

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

  const timeout = overrides.timeout ?? numberFromEnv("LLM_TIMEOUT_MS", 60000);
  const maxRetries = overrides.maxRetries ?? numberFromEnv("LLM_MAX_RETRIES", 1);
  const maxTokens = overrides.maxTokens ?? numberFromEnv("OPENAI_MAX_TOKENS", 2048);

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
    timeout,
    maxRetries,
    // A hung provider call must fail the request instead of holding the
    // connection open forever.
    streaming: false,
    configuration: {
      defaultHeaders,
      ...(baseURL ? { baseURL } : {}),
      ...(overrides.configuration || {}),
    },
  };

  if (maxTokens > 0) {
    config.maxTokens = maxTokens;
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
