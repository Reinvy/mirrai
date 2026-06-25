"use strict";

const {
  chatChain,
  streamChat,
  invokeWithImages,
  streamWithImages,
} = require("../llm/chains/chat-chain");
const { buildSystemPrompt, buildChatInput } = require("../llm/prompts/chat-prompt");

function buildResponseContext({
  name,
  profile,
  personality,
  personalityTrend,
  emotion,
  memories,
  reasoning,
  threadContext,
}) {
  return buildSystemPrompt({
    name,
    profile,
    personality,
    personalityTrend,
    emotion,
    memories,
    reasoning,
    threadContext,
  });
}

async function generateResponse(params) {
  const {
    userInput,
    attachments,
    name,
    profile,
    personality,
    personalityTrend,
    emotion,
    memories,
    reasoning,
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
      reasoning,
      threadContext,
    });
    return await invokeWithImages({ systemMessage, userText: userInput, attachments });
  }

  return await chatChain.invoke(
    buildChatInput({
      name,
      profile,
      personality,
      personalityTrend,
      emotion,
      memories,
      reasoning,
      threadContext,
      userInput,
    }),
  );
}

function streamResponse(params) {
  const {
    userInput,
    attachments,
    name,
    profile,
    personality,
    personalityTrend,
    emotion,
    memories,
    reasoning,
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
      reasoning,
      threadContext,
    });
    return streamWithImages({ systemMessage, userText: userInput, attachments });
  }

  return streamChat(
    buildChatInput({
      name,
      profile,
      personality,
      personalityTrend,
      emotion,
      memories,
      reasoning,
      threadContext,
      userInput,
    }),
  );
}

module.exports = {
  generateResponse,
  streamResponse,
  buildResponseContext,
};
