"use strict";

const { ChatPromptTemplate } = require("@langchain/core/prompts");

const emotionPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Kamu adalah emotion detector yang akurat.
Analisa emosi dari teks input pengguna dan return HANYA JSON, tanpa penjelasan tambahan.
Format output: {{"emotion":"<label>","confidence":<angka 0.0-1.0>}}
Label emosi yang valid: happy, sad, angry, anxious, neutral, excited, confused, lonely`,
  ],
  ["human", "{userInput}"],
]);

module.exports = { emotionPrompt };
