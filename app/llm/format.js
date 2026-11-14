"use strict";

const PERSONALITY_TRAITS = ["empathy", "logic", "humor", "confidence", "playfulness"];

const MAX_MEMORY_ITEMS = 5;
const MAX_MEMORY_CHARS = 500;
const MAX_THREAD_ITEMS = 5;
const MAX_THREAD_CHARS = 1000;
const MAX_BIO_CHARS = 280;

function stripDelimiters(text) {
  return String(text).replace(/[<>]/g, "");
}

function truncate(text, maxChars) {
  const value = String(text);
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
}

function sanitize(text, maxChars) {
  return truncate(stripDelimiters(String(text)).trim(), maxChars);
}

function formatProfile({ name, bio } = {}) {
  const rawName = name && String(name).trim() ? String(name).trim() : "User";
  const safeName = sanitize(rawName, 64);
  const safeBio = bio && String(bio).trim() ? sanitize(bio, MAX_BIO_CHARS) : "(belum ada bio)";
  return `Nama: ${safeName}\nBio: ${safeBio}`;
}

function formatPersonality(personality) {
  if (!personality || typeof personality !== "object") return "Personality belum tersedia";
  return PERSONALITY_TRAITS.filter((k) => typeof personality[k] === "number")
    .map((k) => `${k}: ${(personality[k] * 100).toFixed(0)}%`)
    .join(", ");
}

function formatMemories(memories) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return "(belum ada memory relevan)";
  }
  return memories
    .slice(0, MAX_MEMORY_ITEMS)
    .map((m, i) => {
      const type = m?.type ? `[${m.type}]` : "[MEMORY]";
      const content = m?.content ? sanitize(m.content, MAX_MEMORY_CHARS) : "";
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
  const ordered = [...messages].reverse().slice(-MAX_THREAD_ITEMS);
  return ordered
    .map((m) => {
      const userPart = m?.message
        ? `User: ${sanitize(m.message, MAX_THREAD_CHARS)}`
        : "";
      const twinPart = m?.response
        ? `Twin: ${sanitize(m.response, MAX_THREAD_CHARS)}`
        : "";
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
