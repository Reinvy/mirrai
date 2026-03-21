"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { llm } = require("../../config/openrouter");
const { chatPrompt } = require("../prompts/chat-prompt");

const chatChain = chatPrompt.pipe(llm).pipe(new StringOutputParser());

module.exports = { chatChain };
