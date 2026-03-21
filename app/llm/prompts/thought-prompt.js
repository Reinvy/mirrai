"use strict";

const { ChatPromptTemplate } = require("@langchain/core/prompts");

const thoughtPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Kamu adalah internal thought simulator untuk mensimulasikan cara berpikir seorang user.
Berdasarkan personality dan memory user, buat reasoning chain internal yang mencerminkan pola pikir mereka.
Tulis 3-5 kalimat reasoning singkat dalam perspektif orang pertama.
Jangan tambahkan label atau penjelasan — hanya reasoning chain-nya saja.`,
  ],
  [
    "human",
    `Personality traits: {personality}

Memory relevan:
{memories}

Pesan user: {userInput}

Buat reasoning internal:`,
  ],
]);

module.exports = { thoughtPrompt };
