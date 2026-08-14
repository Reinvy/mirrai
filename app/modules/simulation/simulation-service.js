"use strict";

const { prisma } = require("../../config/db");
const { getLlm } = require("../../config/openrouter");
const { getPersonality } = require("../personality/personality-service");
const { retrieveMemory } = require("../memory/memory-service");
const { logger } = require("../../config/logger");

/**
 * Procedural simulation fallback when LLM is unavailable
 */
function generateFallbackBranches(scenario) {
  return [
    {
      id: "branch-1",
      name: "Jalur Agresif & Pertumbuhan Tinggi",
      description: `Mengambil langkah berani terkait: "${scenario}". Memaksimalkan potensi upside dan percepatan karir/hidup.`,
      probability: 72,
      riskLevel: "Tinggi",
      happinessForecast: 85,
      predictedEmotion: "excited",
      counselReview: {
        rational: "Peluang pertumbuhan eksponensial, namun butuh manajemen cashflow & energi yang ketat.",
        emotional: "Akan ada adrenalin tinggi dan kepuasan pencapaian yang luar biasa jika berhasil.",
        futureSelf: "Di masa depan, kita tidak pernah menyesali langkah berani ini, kita belajar sangat banyak.",
      },
    },
    {
      id: "branch-2",
      name: "Jalur Seimbang & Terencana (Hybrid)",
      description: `Mengeksekusi "${scenario}" secara bertahap sambil mempertahankan stabilitas fondasi saat ini.`,
      probability: 88,
      riskLevel: "Sedang",
      happinessForecast: 80,
      predictedEmotion: "calm",
      counselReview: {
        rational: "Strategi paling optimal dari segi risk-adjusted return. Volatilitas terkendali.",
        emotional: "Tingkat stres jauh lebih rendah, memberi ruang bernapas untuk kesehatan mental.",
        futureSelf: "Pilihan yang sangat bijak dan solid yang membuat perjalanan terasa stabil.",
      },
    },
    {
      id: "branch-3",
      name: "Jalur Konservatif & Penguatan Fondasi",
      description: `Mempertahankan kondisi sekarang, mematangkan persiapan sebelum mengeksekusi "${scenario}".`,
      probability: 95,
      riskLevel: "Rendah",
      happinessForecast: 68,
      predictedEmotion: "neutral",
      counselReview: {
        rational: "Menjaga risiko kegagalan mendekati nol, namun ada opportunity cost yang hilang.",
        emotional: "Rasa aman tinggi, namun mungkin muncul rasa penasaran atau FOMO.",
        futureSelf: "Aman, tapi kamu tahu potensimu jauh lebih besar dari sekadar bertahan di zona nyaman.",
      },
    },
  ];
}

/**
 * Generate branching life decision simulations
 */
async function simulateScenario({ userId, scenario, title }) {
  const [personality, memories] = await Promise.all([
    getPersonality(userId).catch(() => ({ empathy: 0.6, logic: 0.7, humor: 0.5, confidence: 0.6, playfulness: 0.5 })),
    retrieveMemory({ userId, query: scenario, limit: 4 }).catch(() => []),
  ]);

  let branches = [];
  try {
    const llm = getLlm();
    const prompt = `User menghadapi dilema / skenario hidup: "${scenario}".
Personality traits: Empathy ${(personality.empathy * 100).toFixed(0)}%, Logic ${(personality.logic * 100).toFixed(0)}%, Confidence ${(personality.confidence * 100).toFixed(0)}%.
Memory relevan: ${memories.map((m) => m.content).join("; ") || "Belum ada"}.

Buat 3 cabang skenario masa depan (JSON array) dengan struktur:
[
  {
    "id": "branch-1",
    "name": "Nama Jalur",
    "description": "Deskripsi singkat strategi",
    "probability": 75,
    "riskLevel": "Rendah|Sedang|Tinggi",
    "happinessForecast": 80,
    "predictedEmotion": "excited|happy|calm|anxious",
    "counselReview": {
      "rational": "Analisis sisi rasional",
      "emotional": "Analisis sisi emosional",
      "futureSelf": "Pesan dari diri 10 tahun ke depan"
    }
  }
]
HANYA RETURN JSON VALID TANPA MARKDOWN!`;

    const res = await llm.invoke(prompt);
    const content = res?.content || "";
    const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
    branches = JSON.parse(cleanJson);
  } catch (err) {
    logger.warn({ message: "LLM simulation failed, using structured fallback", error: err.message });
    branches = generateFallbackBranches(scenario);
  }

  const session = await prisma.simulationSession.create({
    data: {
      userId,
      title: title || scenario.slice(0, 50),
      scenario,
      branches,
    },
  }).catch(() => ({
    id: `sim-${Date.now()}`,
    userId,
    title: title || scenario.slice(0, 50),
    scenario,
    branches,
    createdAt: new Date(),
  }));

  return session;
}

/**
 * Conduct Council of Selves debate
 */
async function conductCouncilDebate({ userId, dilemma }) {
  const [personality, memories] = await Promise.all([
    getPersonality(userId).catch(() => ({ empathy: 0.6, logic: 0.7, humor: 0.5, confidence: 0.6, playfulness: 0.5 })),
    retrieveMemory({ userId, query: dilemma, limit: 3 }).catch(() => []),
  ]);

  let debate = [];
  try {
    const llm = getLlm();
    const prompt = `Dilema user: "${dilemma}".
Buat simulasi debat meja bundar antara 4 persona internal user:
1. "Rational Strategist" (Logika, efisiensi, probabilitas)
2. "Empathic Heart" (Perasaan, integritas emosional, hubungan)
3. "Shadow / Challenger" (Menantang ilusi & ketakutan tersembunyi)
4. "Future Self (10 Years)" (Sintesis kebijaksanaan jangka panjang)

Kembalikan format JSON:
{
  "consensus": "Kesimpulan bersama atau jalan tengah terbaik",
  "recommendedAction": "Langkah aksi konkret nomor 1 yang harus diambil",
  "transcripts": [
    { "speaker": "Rational Strategist", "role": "Logic Core", "message": "...", "color": "#6366f1" },
    { "speaker": "Empathic Heart", "role": "Emotional Intuition", "message": "...", "color": "#ec4899" },
    { "speaker": "Shadow Self", "role": "Bias Challenger", "message": "...", "color": "#f59e0b" },
    { "speaker": "Future Self", "role": "10-Yr Wisdom", "message": "...", "color": "#10b981" }
  ]
}
HANYA RETURN JSON VALID!`;

    const res = await llm.invoke(prompt);
    const cleanJson = (res?.content || "").replace(/```json/g, "").replace(/```/g, "").trim();
    debate = JSON.parse(cleanJson);
  } catch (e) {
    debate = {
      consensus: `Lakukan langkah bertahap: amankan fondasi rasional, selaraskan dengan nilai emosional terdalam, dan jangan biarkan rasa takut membekukan langkahmu.`,
      recommendedAction: `Luangkan 30 menit hari ini untuk memetakan pro & kontra terberat, lalu buat keputusan mikro pertama.`,
      transcripts: [
        {
          speaker: "Rational Strategist",
          role: "Logic Core",
          message: "Data menunjukkan bahwa ketidakpastian adalah bagian dari setiap keputusan besar. Kuncinya adalah mengidentifikasi skenario terburuk dan menyiapkan rencana mitigasi.",
          color: "#6366f1",
        },
        {
          speaker: "Empathic Heart",
          role: "Emotional Intuition",
          message: "Jangan abaikan apa yang membuat hatimu bersemangat. Logika penting, tetapi motivasi yang bertahan lama berasal dari apa yang benar-benar bermakna bagimu.",
          color: "#ec4899",
        },
        {
          speaker: "Shadow Self",
          role: "Bias Challenger",
          message: "Pertanyakan apakah kamu ragu karena situasinya benar-benar rumit, atau karena kamu takut dihakimi jika hasilnya tidak sempurna?",
          color: "#f59e0b",
        },
        {
          speaker: "Future Self",
          role: "10-Yr Wisdom",
          message: "Sepuluh tahun dari sekarang, kamu akan melihat momen ini sebagai titik balik penting di mana kamu memilih untuk berkembang daripada berdiam diri.",
          color: "#10b981",
        },
      ],
    };
  }

  return debate;
}

/**
 * Get user simulation history
 */
async function getUserSimulations(userId) {
  return prisma.simulationSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  }).catch(() => []);
}

module.exports = { simulateScenario, conductCouncilDebate, getUserSimulations };
