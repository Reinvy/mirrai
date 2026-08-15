"use strict";

const {
  chatChain,
  streamChatRaw,
  invokeWithImages,
  streamWithImages,
} = require("../llm/chains/chat-chain");
const { buildSystemPrompt, buildChatInput } = require("../llm/prompts/chat-prompt");

function extractReasoning(message) {
  if (!message || typeof message !== "object") return null;
  const kw = message.additional_kwargs || {};
  if (typeof kw.reasoning_content === "string" && kw.reasoning_content) {
    return kw.reasoning_content;
  }
  if (typeof kw.reasoning === "string" && kw.reasoning) {
    return kw.reasoning;
  }
  if (Array.isArray(message.content)) {
    const block = message.content.find((c) => c && c.type === "reasoning");
    if (block && typeof block.reasoning === "string" && block.reasoning) {
      return block.reasoning;
    }
  }
  return null;
}

function extractReasoningDelta(chunk) {
  if (!chunk || typeof chunk !== "object") return null;
  const kw = chunk.additional_kwargs || {};
  if (typeof kw.reasoning_content === "string" && kw.reasoning_content) {
    return kw.reasoning_content;
  }
  if (typeof kw.reasoning === "string" && kw.reasoning) {
    return kw.reasoning;
  }
  return null;
}

function pickTextFromMessage(message) {
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) {
    return message.content
      .map((c) => (typeof c === "string" ? c : c.text || ""))
      .join("");
  }
  return "";
}

function buildResponseContext({
  name,
  profile,
  personality,
  personalityTrend,
  emotion,
  memories,
  threadContext,
}) {
  return buildSystemPrompt({
    name,
    profile,
    personality,
    personalityTrend,
    emotion,
    memories,
    threadContext,
  });
}

async function generateResponse(params, { llm } = {}) {
  const {
    userInput,
    attachments,
    name,
    profile,
    personality,
    personalityTrend,
    emotion,
    memories,
    threadContext,
  } = params;

  if (attachments && attachments.length > 0) {
    const systemMessage = buildResponseContext({
      name,
      profile,
      personality,
      personalityTrend,
      emotion,
      memories,
      threadContext,
    });
    const text = await invokeWithImages(
      { systemMessage, userText: userInput, attachments },
      { llm },
    );
    return { text, reasoning: null };
  }

  const result = await chatChain.invokeRaw(
    buildChatInput({
      name,
      profile,
      personality,
      personalityTrend,
      emotion,
      memories,
      threadContext,
      userInput,
    }),
    { llm },
  );

  return {
    text: pickTextFromMessage(result),
    reasoning: extractReasoning(result),
  };
}

async function* streamResponse(params, { llm } = {}) {
  const {
    userInput,
    attachments,
    name,
    profile,
    personality,
    personalityTrend,
    emotion,
    memories,
    threadContext,
  } = params;

  if (attachments && attachments.length > 0) {
    const systemMessage = buildResponseContext({
      name,
      profile,
      personality,
      personalityTrend,
      emotion,
      memories,
      threadContext,
    });
    for await (const text of streamWithImages(
      { systemMessage, userText: userInput, attachments },
      { llm },
    )) {
      yield { type: "delta", text };
    }
    return;
  }

  let buffer = "";
  for await (const chunk of streamChatRaw(
    buildChatInput({
      name,
      profile,
      personality,
      personalityTrend,
      emotion,
      memories,
      threadContext,
      userInput,
    }),
    { llm },
  )) {
    const reasoningDelta = extractReasoningDelta(chunk);
    if (reasoningDelta) {
      buffer += reasoningDelta;
      yield { type: "reasoning", text: reasoningDelta };
    }
    const text = pickTextFromMessage(chunk);
    if (text) {
      yield { type: "delta", text };
    }
  }
  if (!buffer) {
    yield { type: "reasoning", text: null, final: true };
  }
}

function extractReasoningFromChunk(chunk) {
  return extractReasoningDelta(chunk);
}

module.exports = {
  generateResponse,
  streamResponse,
  buildResponseContext,
  extractReasoning,
  extractReasoningFromChunk,
};
