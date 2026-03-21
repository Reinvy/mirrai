"use strict";

const { JsonOutputParser } = require("@langchain/core/output_parsers");
const { llm } = require("../../config/openrouter");
const { emotionPrompt } = require("../prompts/emotion-prompt");

const emotionChain = emotionPrompt.pipe(llm).pipe(new JsonOutputParser());

module.exports = { emotionChain };
