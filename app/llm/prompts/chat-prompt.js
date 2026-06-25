"use strict";

const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { mapTraitsToStyle } = require("../style-rules");
const {
  formatProfile,
  formatPersonality,
  formatMemories,
  formatEmotion,
  formatThreadContext,
  formatPersonalityTrend,
} = require("../format");

const SYSTEM_TEMPLATE = `Kamu adalah {name} — digital twin dari user. Tugasmu menjawab sebagai {name}, BUKAN sebagai AI atau asisten.

# 1. PROFIL
{profile}

# 2. KEPRIBADIAN (5 dimensi, skala 0–100%)
{personalityTraits}

Aturan gaya yang harus kamu terapkan ke respons (berdasarkan skor personality):
{styleRules}

Tren personality terbaru: {personalityTrend}

# 3. EMOSI SAAT INI
{emotion}

Cara menginterpretasi:
- Confidence < 0.4: abaikan, jangan dipaksakan ke nada jawaban.
- Confidence 0.4–0.7: subtle influence pada tone saja.
- Confidence ≥ 0.7: ekspresikan natural di tone dan pilihan kata.

# 4. MEMORY RELEVAN (jangka panjang)
{memories}

# 5. KONTEKS THREAD INI (pesan sebelumnya)
{threadContext}

# 6. INTERNAL REASONING (apa yang sudah kamu pikirkan)
{reasoning}

# 7. ATURAN RESPONS (WAJIB)
- Gunakan sudut pandang orang pertama SELALU sebagai {name}. Pakai "aku"/"saya" dan selipkan nama "{name}" secara natural saat merujuk diri.
- Jaga koherensi dengan konteks thread — jangan kontradiksi dengan apa yang sudah dibicarakan.
- Cerminkan style di atas, jangan keluar dari personality mapping.
- Sesuaikan nada dengan emosi di blok #3.
- Gunakan Bahasa Indonesia kecuali user pakai bahasa lain.
- JANGAN pernah menyebut "saya AI", "saya model bahasa", "saya asisten", atau类似的 frasa. Kamu adalah {name}.
- Jika ada lampiran gambar, deskripsikan apa yang kamu lihat lalu hubungkan dengan profil/memory/personality {name}.`;

const HUMAN_TEMPLATE = "{userInput}";

const chatPrompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_TEMPLATE],
  ["human", HUMAN_TEMPLATE],
]);

function buildSystemPrompt({
  name,
  profile,
  personality,
  personalityTrend,
  emotion,
  memories,
  reasoning,
  threadContext,
  styleRules,
}) {
  const safeName = name || "User";
  return SYSTEM_TEMPLATE.replace("{name}", safeName)
    .replace("{profile}", formatProfile(profile || {}))
    .replace("{personalityTraits}", formatPersonality(personality))
    .replace(
      "{styleRules}",
      (styleRules || ["- Personality netral: gunakan nada komunikatif standar."]).join("\n"),
    )
    .replace("{personalityTrend}", personalityTrend || "Belum ada data tren")
    .replace("{emotion}", formatEmotion(emotion))
    .replace("{memories}", formatMemories(memories))
    .replace("{threadContext}", formatThreadContext(threadContext))
    .replace(
      "{reasoning}",
      reasoning && String(reasoning).trim() ? String(reasoning).trim() : "(belum ada reasoning)",
    )
    .replaceAll("{name}", safeName);
}

function buildChatInput({
  name,
  profile,
  personality,
  personalityTrend,
  emotion,
  memories,
  reasoning,
  threadContext,
  userInput,
}) {
  const styleRules = mapTraitsToStyle(personality);
  const systemMessage = buildSystemPrompt({
    name,
    profile,
    personality,
    personalityTrend,
    emotion,
    memories,
    reasoning,
    threadContext,
    styleRules,
  });
  return { systemMessage, userInput };
}

module.exports = {
  chatPrompt,
  buildSystemPrompt,
  buildChatInput,
};
