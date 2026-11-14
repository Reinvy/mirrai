"use strict";

const { ChatOpenAI } = require("@langchain/openai");
const { prisma } = require("../config/db");
const { decrypt, maskApiKey } = require("../utils/crypto");
const { getLlm, resolveLlmConfig } = require("../config/openai");
const { assertSafeByokBaseUrl } = require("../utils/url-safety");
const { AppError } = require("../utils/app-error");
const { logger } = require("../config/logger");

const DEFAULT_THINKING_EFFORT = "medium";

function buildReasoningPayload(enabled) {
  if (!enabled) return null;
  return { effort: DEFAULT_THINKING_EFFORT };
}

function sessionFor(userId, sessionId) {
  return sessionId ?? `mirrai-user-${userId}`;
}

function systemLlm(sessionId) {
  return {
    llm: getLlm({ sessionId }),
    byok: false,
    thinkingEnabled: false,
    visionEnabled: false,
  };
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

async function getLlmForUser(userId, { sessionId } = {}) {
  const resolvedSessionId = sessionFor(userId, sessionId);
  const user = await getUserByokConfig(userId);
  if (!user || !user.byokEnabled) {
    return systemLlm(resolvedSessionId);
  }
  if (!user.byokApiKey || !user.byokBaseUrl || !user.byokModel) {
    return systemLlm(resolvedSessionId);
  }

  try {
    await assertSafeByokBaseUrl(user.byokBaseUrl);
  } catch (err) {
    logger.error({
      message: "Stored BYOK baseUrl rejected; falling back to system LLM",
      userId,
      error: err.message,
    });
    return systemLlm(resolvedSessionId);
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
    return systemLlm(resolvedSessionId);
  }

  const thinkingEnabled = Boolean(user.byokThinkingEnabled);
  const visionEnabled = Boolean(user.byokVisionEnabled);
  const llm = new ChatOpenAI(
    resolveLlmConfig({
      apiKey,
      baseURL: user.byokBaseUrl,
      model: user.byokModel,
      sessionId: resolvedSessionId,
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

  const base = {
    enabled: false,
    baseUrl: null,
    model: null,
    apiKeyMasked: null,
    thinkingEnabled: false,
    visionEnabled: false,
    requiresReconfigure: false,
  };

  if (!user.byokEnabled) {
    return base;
  }

  let apiKeyMasked = null;
  let requiresReconfigure = false;
  try {
    apiKeyMasked = maskApiKey(decrypt(user.byokApiKey));
  } catch (err) {
    logger.error({
      message: "Stored BYOK key cannot be decrypted",
      userId,
      error: err.message,
    });
    requiresReconfigure = true;
  }

  return {
    enabled: true,
    baseUrl: user.byokBaseUrl,
    model: user.byokModel,
    apiKeyMasked,
    thinkingEnabled: Boolean(user.byokThinkingEnabled),
    visionEnabled: Boolean(user.byokVisionEnabled),
    requiresReconfigure,
  };
}

async function setByokConfig(
  userId,
  { enabled, baseUrl, apiKey, model, thinkingEnabled, visionEnabled },
) {
  const update = {};
  if (typeof enabled === "boolean") {
    update.byokEnabled = enabled;
  }
  if (baseUrl !== undefined) {
    await assertSafeByokBaseUrl(baseUrl);
    update.byokBaseUrl = baseUrl;
  }
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

async function resolveTestApiKey(userId, apiKey) {
  if (typeof apiKey === "string" && apiKey.length > 0) {
    return apiKey;
  }
  if (!userId) {
    throw new AppError(400, "API key belum tersimpan");
  }
  const stored = await prisma.user.findUnique({
    where: { id: userId },
    select: { byokApiKey: true },
  });
  if (!stored?.byokApiKey) {
    throw new AppError(400, "API key belum tersimpan");
  }
  try {
    return decrypt(stored.byokApiKey);
  } catch {
    throw new AppError(400, "API key tersimpan tidak dapat didekripsi, simpan ulang key");
  }
}

async function testByokConnection(
  userId,
  { baseUrl, apiKey, model, thinkingEnabled, visionEnabled },
) {
  if (!baseUrl || !model) {
    throw new AppError(400, "baseUrl dan model wajib diisi");
  }
  await assertSafeByokBaseUrl(baseUrl);
  const resolvedKey = await resolveTestApiKey(userId, apiKey);

  const llm = new ChatOpenAI(
    resolveLlmConfig({
      apiKey: resolvedKey,
      baseURL: baseUrl,
      model,
      sessionId: sessionFor(userId, null),
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
      sample:
        typeof result?.content === "string" ? result.content.slice(0, 80) : "(no text)",
      visionEnabled: Boolean(visionEnabled),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: String(err.message || "Unknown error").slice(0, 300),
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
