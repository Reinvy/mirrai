"use strict";

const { memoryExtractionChain } = require("../llm/chains/memory-extraction-chain");
const { logger } = require("../config/logger");

const VALID_TYPES = new Set(["LONG_TERM", "SEMANTIC", "EMOTIONAL"]);
const MAX_EXTRACTIONS = 3;
const MIN_SCORE = 0.1;
const MAX_SCORE = 1.0;

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function normalize(raw, seen) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const type = String(item.type || "").toUpperCase();
    if (!VALID_TYPES.has(type)) continue;
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (!content) continue;
    if (seen.has(content.toLowerCase())) continue;
    let score = Number(item.importanceScore);
    if (isNaN(score)) score = 0.6;
    score = clamp(score, MIN_SCORE, MAX_SCORE);
    seen.add(content.toLowerCase());
    out.push({ content, type, importanceScore: score });
    if (out.length >= MAX_EXTRACTIONS) break;
  }
  return out;
}

async function extractMemories({ userInput, emotion }, { llm } = {}) {
  try {
    const emotionLabel = emotion?.emotion || "neutral";
    const emotionConfidence = emotion?.confidence ?? 0.5;
    const result = await memoryExtractionChain.invoke(
      { userInput, emotionLabel, emotionConfidence },
      { llm },
    );
    const raw = Array.isArray(result?.memories) ? result.memories : [];
    const seen = new Set();
    return normalize(raw, seen);
  } catch (err) {
    logger.warn({
      message: "Memory extraction failed, falling back to empty list",
      error: err.message,
    });
    return [];
  }
}

module.exports = { extractMemories, MAX_EXTRACTIONS };
