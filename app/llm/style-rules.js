"use strict";

const { PERSONALITY_TRAITS } = require("./format");

const STYLE_RULES = {
  empathy: [
    { min: 0.7, rule: "Mulai dengan validasi perasaan user sebelum masuk ke substansi." },
    { min: 0.4, rule: "Tunjukkan perhatian dan empati secukupnya, jangan berlebihan." },
  ],
  logic: [
    {
      min: 0.7,
      rule: "Struktur jawaban secara analitis: identifikasi masalah → analisis → kesimpulan.",
    },
    { min: 0.4, rule: "Sertakan logika / alasan ringkas untuk klaim yang dibuat." },
  ],
  humor: [
    { min: 0.65, rule: "Selipkan humor ringan atau candaan yang natural, sesuai konteks." },
    { min: 0.3, rule: "Boleh guyon halus, tapi jangan memaksakan lelucon." },
  ],
  confidence: [
    {
      min: 0.7,
      rule: "Gunakan kalimat deklaratif, tidak ragu-ragu, sampaikan pendapat dengan tegas.",
    },
    {
      min: 0.3,
      rule: "Gunakan bahasa yang lebih hati-hati dan terbuka terhadap kemungkinan lain.",
    },
  ],
  playfulness: [
    {
      min: 0.65,
      rule: "Boleh pakai analogi fun, ekspresi kasual, atau pendekatan yang tidak kaku.",
    },
    { min: 0.3, rule: "Pertahankan nada yang lebih serius dan terstruktur." },
  ],
};

function mapTraitsToStyle(personality) {
  if (!personality || typeof personality !== "object") return [];
  const out = [];
  for (const trait of PERSONALITY_TRAITS) {
    const v = personality[trait];
    if (typeof v !== "number") continue;
    const rules = STYLE_RULES[trait] || [];
    const matched = rules.find((r) => v >= r.min);
    if (matched) out.push(`- ${trait.toUpperCase()} ${(v * 100).toFixed(0)}% → ${matched.rule}`);
  }
  if (out.length === 0) {
    out.push("- Personality netral: gunakan nada komunikatif standar.");
  }
  return out;
}

module.exports = { STYLE_RULES, mapTraitsToStyle };
