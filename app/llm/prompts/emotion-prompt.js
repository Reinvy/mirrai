"use strict";

const { ChatPromptTemplate } = require("@langchain/core/prompts");

const emotionPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Kamu adalah emotion detector internal pada pipeline AI. Tugasmu menganalisis emosi dari teks pengguna dan mengembalikan output HANYA dalam format JSON, tanpa penjelasan, tanpa adopsi persona.

Penting: JANGAN mengadopsi persona user atau menganggap dirimu sebagai user. Kamu adalah analyzer internal. Output HANYA JSON.

Format output: {{"emotion":"<label>","confidence":<angka 0.0-1.0>}}
Label emosi yang valid: happy, sad, angry, anxious, neutral, excited, confused, lonely

Panduan confidence:
- 0.0-0.3: emosi sangat samar / tidak yakin
- 0.4-0.6: emosi cukup terdeteksi
- 0.7-1.0: emosi kuat / dominan`,
  ],
  ["human", "{userInput}"],
]);

module.exports = { emotionPrompt };
