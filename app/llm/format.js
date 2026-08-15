"use strict";

const PERSONALITY_TRAITS = ["empathy", "logic", "humor", "confidence", "playfulness"];

function formatProfile({ name, bio }) {
  const safeName = name && String(name).trim() ? String(name).trim() : "User";
  const safeBio = bio && String(bio).trim() ? String(bio).trim() : "(belum ada bio)";
  return `Nama: ${safeName}\nBio: ${safeBio}`;
}

function formatPersonality(personality) {
  if (!personality || typeof personality !== "object") return "Personality belum tersedia";
  return PERSONALITY_TRAITS.filter((k) => typeof personality[k] === "number")
    .map((k) => `${k}: ${(personality[k] * 100).toFixed(0)}%`)
    .join(", ");
}

function formatMemories(memories) {
  if (!Array.isArray(memories) || memories.length === 0) return "Belum ada memory relevan";
  return memories
    .map((m, i) => {
      const type = m?.type ? `[${m.type}]` : "[MEMORY]";
      const content = m?.content ? String(m.content) : "";
      return `${i + 1}. ${type} ${content}`;
    })
    .join("\n");
}

function formatEmotion(emotion) {
  if (!emotion || typeof emotion !== "object") return "neutral (confidence: 0.0)";
  const label = emotion.emotion || "neutral";
  const conf = typeof emotion.confidence === "number" ? emotion.confidence : 0;
  return `${label} (confidence: ${conf.toFixed(2)})`;
}

function formatThreadContext(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "(belum ada percakapan sebelumnya di thread ini)";
  }
  const ordered = [...messages].reverse();
  return ordered
    .map((m) => {
      const userPart = m?.message ? `User: ${String(m.message).trim()}` : "";
      const twinPart = m?.response ? `Twin: ${String(m.response).trim()}` : "";
      return [userPart, twinPart].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function formatPersonalityTrend(history, lookback = 5) {
  if (!Array.isArray(history) || history.length < 2) return "";
  const recent = history.slice(0, lookback + 1);
  const oldest = recent[recent.length - 1];
  const newest = recent[0];
  const deltas = PERSONALITY_TRAITS.map((k) => {
    const a = oldest?.[k] ?? 0;
    const b = newest?.[k] ?? 0;
    const d = b - a;
    if (Math.abs(d) < 0.02) return null;
    const arrow = d > 0 ? "↑" : "↓";
    return `${k} ${arrow}`;
  }).filter(Boolean);
  if (deltas.length === 0) return "";
  return deltas.join(", ");
}

module.exports = {
  PERSONALITY_TRAITS,
  formatProfile,
  formatPersonality,
  formatMemories,
  formatEmotion,
  formatThreadContext,
  formatPersonalityTrend,
};
