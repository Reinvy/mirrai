"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { getLlm } = require("../../config/openai");

const SIMPLE_PROMPT = ChatPromptTemplate.fromMessages([
  ["system", "{systemMessage}"],
  ["human", "{userInput}"],
]);

function buildChain(llm) {
  return SIMPLE_PROMPT.pipe(llm).pipe(new StringOutputParser());
}

function buildModelOnlyChain(llm) {
  return SIMPLE_PROMPT.pipe(llm);
}

async function* streamChat(input, { llm } = {}) {
  const target = llm || getLlm();
  const stream = await buildChain(target).stream(input);
  for await (const chunk of stream) {
    if (typeof chunk === "string" && chunk) yield chunk;
  }
}

async function* streamChatRaw(input, { llm } = {}) {
  const target = llm || getLlm();
  const stream = await buildModelOnlyChain(target).stream(input);
  for await (const chunk of stream) {
    yield chunk;
  }
}

const chatChain = {
  invoke: async (input, { llm } = {}) => buildChain(llm || getLlm()).invoke(input),
  stream: streamChat,
  streamRaw: streamChatRaw,
  invokeRaw: async (input, { llm } = {}) => buildModelOnlyChain(llm || getLlm()).invoke(input),
};

async function invokeWithImages({ systemMessage, userText, attachments }, { llm } = {}) {
  const target = llm || getLlm();
  const content = [];

  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att?.type === "image" && att.dataUrl) {
        content.push({
          type: "image_url",
          image_url: { url: att.dataUrl },
        });
      }
    }
  }
  content.push({ type: "text", text: userText || "" });

  const messages = [new SystemMessage(systemMessage), new HumanMessage({ content })];

  const result = await target.invoke(messages);
  return typeof result.content === "string"
    ? result.content
    : Array.isArray(result.content)
      ? result.content.map((c) => (typeof c === "string" ? c : c.text || "")).join("")
      : String(result.content);
}

async function* streamWithImages({ systemMessage, userText, attachments }, { llm } = {}) {
  const target = llm || getLlm();
  const content = [];

  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att?.type === "image" && att.dataUrl) {
        content.push({
          type: "image_url",
          image_url: { url: att.dataUrl },
        });
      }
    }
  }
  content.push({ type: "text", text: userText || "" });

  const messages = [new SystemMessage(systemMessage), new HumanMessage({ content })];

  const stream = await target.stream(messages);
  for await (const chunk of stream) {
    const text =
      typeof chunk.content === "string"
        ? chunk.content
        : Array.isArray(chunk.content)
          ? chunk.content.map((c) => (typeof c === "string" ? c : c.text || "")).join("")
          : "";
    if (text) yield text;
  }
}

function getModelOnlyChain(llm) {
  return buildModelOnlyChain(llm || getLlm());
}

module.exports = {
  chatChain,
  streamChat,
  streamChatRaw,
  getModelOnlyChain,
  invokeWithImages,
  streamWithImages,
};
