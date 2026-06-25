"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { getLlm } = require("../../config/openai");

const SIMPLE_PROMPT = ChatPromptTemplate.fromMessages([
  ["system", "{systemMessage}"],
  ["human", "{userInput}"],
]);

let _chain = null;
let _modelOnlyChain = null;

function getChain() {
  if (!_chain) {
    _chain = SIMPLE_PROMPT.pipe(getLlm()).pipe(new StringOutputParser());
  }
  return _chain;
}

function getModelOnlyChain() {
  if (!_modelOnlyChain) {
    _modelOnlyChain = SIMPLE_PROMPT.pipe(getLlm());
  }
  return _modelOnlyChain;
}

async function* streamChat(input) {
  const stream = await getChain().stream(input);
  for await (const chunk of stream) {
    if (typeof chunk === "string" && chunk) yield chunk;
  }
}

const chatChain = {
  invoke: async (input) => getChain().invoke(input),
  stream: streamChat,
};

async function invokeWithImages({ systemMessage, userText, attachments }) {
  const llm = getLlm();
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

  const result = await llm.invoke(messages);
  return typeof result.content === "string"
    ? result.content
    : Array.isArray(result.content)
      ? result.content.map((c) => (typeof c === "string" ? c : c.text || "")).join("")
      : String(result.content);
}

async function* streamWithImages({ systemMessage, userText, attachments }) {
  const llm = getLlm();
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

  const stream = await llm.stream(messages);
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

module.exports = {
  chatChain,
  streamChat,
  getModelOnlyChain,
  invokeWithImages,
  streamWithImages,
};
