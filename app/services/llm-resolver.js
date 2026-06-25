"use strict";

const { ChatOpenAI } = require("@langchain/openai");
const { prisma } = require("../config/db");
const { decrypt, maskApiKey } = require("../utils/crypto");
const { getLlm, resolveLlmConfig } = require("../config/openai");
const { AppError } = require("../utils/app-error");
const { logger } = require("../config/logger");

const DEFAULT_THINKING_EFFORT = "medium";

function buildReasoningPayload(enabled) {
  if (!enabled) return null;
  return { effort: DEFAULT_THINKING_EFFORT };
}

async function getUserByokConfig(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      byokEnabled: true,
      byokApiKey: true,
      byokBaseUrl: true,
      byokModel: true,
      byokThinkingEnabled: true,
      byokVisionEnabled: true,
    },
  });
  if (!user) return null;
  return user;
}

async function getLlmForUser(userId) {
  const user = await getUserByokConfig(userId);
  if (!user || !user.byokEnabled) {
    return {
      llm: getLlm(),
      byok: false,
      thinkingEnabled: false,
      visionEnabled: false,
    };
  }
  if (!user.byokApiKey || !user.byokBaseUrl || !user.byokModel) {
    return {
      llm: getLlm(),
      byok: false,
      thinkingEnabled: false,
      visionEnabled: false,
    };
  }
  let apiKey;
  try {
    apiKey = decrypt(user.byokApiKey);
  } catch (err) {
    logger.error({
      message: "BYOK decrypt failed; falling back to system LLM",
      userId,
      error: err.message,
    });
    return {
      llm: getLlm(),
      byok: false,
      thinkingEnabled: false,
      visionEnabled: false,
    };
  }
  const thinkingEnabled = Boolean(user.byokThinkingEnabled);
  const visionEnabled = Boolean(user.byokVisionEnabled);
  const llm = new ChatOpenAI(
    resolveLlmConfig({
      apiKey,
      baseURL: user.byokBaseUrl,
      model: user.byokModel,
      reasoning: buildReasoningPayload(thinkingEnabled),
    }),
  );
  return { llm, byok: true, thinkingEnabled, visionEnabled };
}

async function getByokStatus(userId) {
  const user = await getUserByokConfig(userId);
  if (!user) {
    throw new AppError(404, "User tidak ditemukan");
  }
  if (!user.byokEnabled) {
    return {
      enabled: false,
      baseUrl: null,
      model: null,
      apiKeyMasked: null,
      thinkingEnabled: false,
      visionEnabled: false,
    };
  }
  return {
    enabled: true,
    baseUrl: user.byokBaseUrl,
    model: user.byokModel,
    apiKeyMasked: maskApiKey(decrypt(user.byokApiKey)),
    thinkingEnabled: Boolean(user.byokThinkingEnabled),
    visionEnabled: Boolean(user.byokVisionEnabled),
  };
}

async function setByokConfig(userId, { enabled, baseUrl, apiKey, model, thinkingEnabled, visionEnabled }) {
  const update = {};
  if (typeof enabled === "boolean") {
    update.byokEnabled = enabled;
  }
  if (baseUrl !== undefined) update.byokBaseUrl = baseUrl;
  if (model !== undefined) update.byokModel = model;
  if (apiKey !== undefined) {
    update.byokApiKey = apiKey ? encrypt(apiKey) : null;
  }
  if (typeof thinkingEnabled === "boolean") {
    update.byokThinkingEnabled = thinkingEnabled;
  }
  if (typeof visionEnabled === "boolean") {
    update.byokVisionEnabled = visionEnabled;
  }
  return prisma.user.update({
    where: { id: userId },
    data: update,
    select: {
      id: true,
      byokEnabled: true,
      byokBaseUrl: true,
      byokModel: true,
      byokThinkingEnabled: true,
      byokVisionEnabled: true,
    },
  });
}

async function disableByok(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      byokEnabled: false,
      byokApiKey: null,
      byokBaseUrl: null,
      byokModel: null,
      byokThinkingEnabled: false,
      byokVisionEnabled: false,
    },
    select: { id: true },
  });
}

async function testByokConnection({ baseUrl, apiKey, model, thinkingEnabled, visionEnabled }) {
  if (!apiKey || !baseUrl || !model) {
    throw new AppError(400, "baseUrl, apiKey, dan model wajib diisi");
  }
  const llm = new ChatOpenAI(
    resolveLlmConfig({
      apiKey,
      baseURL: baseUrl,
      model,
      temperature: 0,
      reasoning: buildReasoningPayload(Boolean(thinkingEnabled)),
    }),
  );
  const start = Date.now();
  try {
    const result = await llm.invoke("ping");
    const latencyMs = Date.now() - start;
    return {
      ok: true,
      latencyMs,
      sample: typeof result?.content === "string" ? result.content.slice(0, 80) : "(no text)",
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message || "Unknown error",
    };
  }
}

function encrypt(value) {
  return require("../utils/crypto").encrypt(value);
}

module.exports = {
  getLlmForUser,
  getByokStatus,
  setByokConfig,
  disableByok,
  testByokConnection,
  maskApiKey,
};
