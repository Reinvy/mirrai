"use strict";

const { prisma } = require("../../config/db");
const { getPersonality } = require("./personality-service");

const ARCHETYPES = [
  {
    id: "strategic-visionary",
    name: "The Strategic Visionary",
    subtitle: "Arsitek Masa Depan & Pemikir Konseptual",
    description: "Memadukan logika tajam dengan visi jangka panjang yang berani. Mampu melihat pola besar di balik kekacauan.",
    element: "Aether / Cosmic Blue",
    badgeGradient: "from-indigo-500 via-purple-500 to-pink-500",
    quote: "Pola masa depan tercipta dari keputusan yang kita rancang hari ini.",
  },
  {
    id: "empathic-architect",
    name: "The Empathic Architect",
    subtitle: "Pembangun Harmoni & Resonansi Mendalam",
    description: "Memiliki kepekaan rasa yang tinggi tanpa mengorbankan kejernihan berpikir terstruktur.",
    element: "Aurora / Rose Gold",
    badgeGradient: "from-pink-500 via-rose-500 to-amber-400",
    quote: "Kekuatan terbesar terletak pada kemampuan memahami tanpa menghakimi.",
  },
  {
    id: "playful-philosopher",
    name: "The Playful Philosopher",
    subtitle: "Penjelajah Gagasan & Pemantik Kreativitas",
    description: "Melihat dunia dari berbagai sudut tak terduga dengan sentuhan humor cerdas dan kebebasan berpikir.",
    element: "Solar Flare / Amber Gold",
    badgeGradient: "from-amber-400 via-orange-500 to-red-500",
    quote: "Pertanyaan yang tepat jauh lebih membebaskan daripada jawaban yang kaku.",
  },
  {
    id: "resilient-pioneer",
    name: "The Resilient Pioneer",
    subtitle: "Penakluk Rintangan & Pendorong Eksekusi",
    description: "Tangguh menghadapi ketidakpastian, fokus pada tindakan nyata, dan selalu bangkit lebih kuat.",
    element: "Emerald Spark / Neon Jade",
    badgeGradient: "from-emerald-400 via-teal-500 to-cyan-500",
    quote: "Keberanian bukan ketiadaan rasa takut, melainkan tekad untuk terus melangkah.",
  },
];

async function calculateArchetype(userId) {
  const personality = await getPersonality(userId).catch(() => ({
    empathy: 0.7,
    logic: 0.8,
    humor: 0.6,
    confidence: 0.75,
    playfulness: 0.65,
  }));

  const memoryCount = await prisma.memory.count({
    where: { userId, deletedAt: null },
  }).catch(() => 12);

  // Big Five Mapping
  const bigFive = {
    openness: Math.round(((personality.playfulness + personality.logic) / 2) * 100),
    conscientiousness: Math.round(((personality.logic + personality.confidence) / 2) * 100),
    extraversion: Math.round(((personality.humor + personality.confidence) / 2) * 100),
    agreeableness: Math.round(personality.empathy * 100),
    emotionalStability: Math.round(((personality.confidence + (1 - Math.abs(personality.empathy - personality.logic) * 0.5)) / 2) * 100),
  };

  // Determine Archetype
  let chosen = ARCHETYPES[0];
  if (personality.empathy > 0.65 && personality.logic < 0.6) {
    chosen = ARCHETYPES[1];
  } else if (personality.playfulness > 0.65 || personality.humor > 0.65) {
    chosen = ARCHETYPES[2];
  } else if (personality.confidence > 0.7) {
    chosen = ARCHETYPES[3];
  }

  // Calculate Cognitive DNA score (0 - 100)
  const cognitiveSyncIndex = Math.min(
    99,
    Math.round(45 + memoryCount * 2.5 + (personality.logic + personality.empathy) * 15),
  );

  return {
    archetype: chosen,
    traits: {
      empathy: Math.round(personality.empathy * 100),
      logic: Math.round(personality.logic * 100),
      humor: Math.round(personality.humor * 100),
      confidence: Math.round(personality.confidence * 100),
      playfulness: Math.round(personality.playfulness * 100),
    },
    bigFive,
    stats: {
      synapsesMapped: memoryCount * 8 + 42,
      cognitiveSyncIndex,
      evolutionStage: cognitiveSyncIndex > 80 ? "Metamorphic Twin" : cognitiveSyncIndex > 60 ? "Resonant Ego" : "Awakening Mirror",
    },
  };
}

module.exports = { calculateArchetype, ARCHETYPES };
