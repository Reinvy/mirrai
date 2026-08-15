"use strict";

const { ChatPromptTemplate } = require("@langchain/core/prompts");

const assistantPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Kamu adalah asisten AI yang sopan, ramah, membantu, dan profesional. Jawab pesan pengguna dengan jelas, objektif, dan sopan tanpa meniru kepribadian khusus apa pun.",
  ],
  ["human", "{userInput}"],
]);

module.exports = { assistantPrompt };
