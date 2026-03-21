"use strict";

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { llm } = require("../../config/openrouter");
const { thoughtPrompt } = require("../prompts/thought-prompt");

const thoughtChain = thoughtPrompt.pipe(llm).pipe(new StringOutputParser());

module.exports = { thoughtChain };
