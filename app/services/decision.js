"use strict";

const {
  chatChain,
  streamChat,
  invokeWithImages,
  streamWithImages,
} = require("../llm/chains/chat-chain");

function formatPersonality(personality) {
  return Object.entries(personality)
    .filter(([k]) =>
      ["empathy", "logic", "humor", "confidence", "playfulness"].includes(k),
    )
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
    .join(", ");
}

function formatMemories(memories) {
  if (!memories || memories.length === 0) return "Belum ada memory relevan";
  return memories
    .map((m, i) => `${i + 1}. [${m.type}] ${m.content}`)
    .join("\n");
}

const BASE_SYSTEM = `Kamu adalah digital twin dari user — AI yang merespons seperti user itu sendiri, bukan sebagai asisten.

Personality traits user:
{personality}

Emosi user saat ini: {emotion}

Memory relevan dari user:
{memories}

Internal reasoning:
{reasoning}

Instruksi penting:
- Respons menggunakan sudut pandang dan gaya bicara user, bukan sebagai AI yang menjawab user
- Cerminkan pola berpikir, kebiasaan, dan kepribadian user berdasarkan history dan traits
- Gunakan Bahasa Indonesia kecuali user menggunakan bahasa lain
- Respons harus natural, personal, dan mencerminkan kondisi emosi user saat ini
- Jika ada gambar yang dilampirkan, deskripsikan apa yang kamu lihat dan hubungkan dengan personality/memory user
- Jangan pernah menyebutkan bahwa kamu adalah AI`;

function buildSystemMessage(personality, emotion, memories, reasoning) {
  return BASE_SYSTEM.replace("{personality}", formatPersonality(personality))
    .replace("{emotion}", `${emotion.emotion} (confidence: ${emotion.confidence})`)
    .replace("{memories}", formatMemories(memories))
    .replace("{reasoning}", reasoning || "");
}

async function generateDecision({
  userInput,
  emotion,
  memories,
  personality,
  reasoning,
  attachments,
}) {
  if (attachments && attachments.length > 0) {
    return await invokeWithImages({
      systemMessage: buildSystemMessage(personality, emotion, memories, reasoning),
      userText: userInput,
      attachments,
    });
  }
  return await chatChain.invoke({
    userInput,
    emotion: `${emotion.emotion} (confidence: ${emotion.confidence})`,
    personality: formatPersonality(personality),
    memories: formatMemories(memories),
    reasoning,
  });
}

function streamDecision({
  userInput,
  emotion,
  memories,
  personality,
  reasoning,
  attachments,
}) {
  if (attachments && attachments.length > 0) {
    return streamWithImages({
      systemMessage: buildSystemMessage(personality, emotion, memories, reasoning),
      userText: userInput,
      attachments,
    });
  }
  return streamChat({
    userInput,
    emotion: `${emotion.emotion} (confidence: ${emotion.confidence})`,
    personality: formatPersonality(personality),
    memories: formatMemories(memories),
    reasoning,
  });
}

module.exports = { generateDecision, streamDecision, buildSystemMessage };
