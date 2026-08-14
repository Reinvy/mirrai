"use strict";

const { prisma } = require("../../config/db");
const { getLlm } = require("../../config/openrouter");
const { detectEmotion } = require("../../services/emotion");
const { generateThought } = require("../../services/thought");
const { evolvePersonality } = require("../../services/evolution");
const { retrieveMemory, saveMemory } = require("../memory/memory-service");
const { getPersonality } = require("../personality/personality-service");
const { logger } = require("../../config/logger");

const PERSONA_PROMPTS = {
  twin: {
    title: "Digital Twin (Authentic Reflection)",
    system: `Kamu adalah digital twin dari user — AI yang merespons persis seperti user itu sendiri, bukan asisten eksternal. Gunakan Bahasa Indonesia kecuali user memakai bahasa lain. Cerminkan cara berpikir dan gaya bicaranya. Jangan pernah menyebut kamu adalah AI.`,
  },
  future_self: {
    title: "Future Self (+10 Years)",
    system: `Kamu adalah diri user dari 10 tahun di masa depan yang telah melalui banyak pelajaran hidup, lebih bijak, tenang, penuh empati namun realistis. Bimbing dirimu saat ini dengan sudut pandang jangka panjang dan kehangatan. Jangan pernah menyebut kamu adalah AI.`,
  },
  shadow_self: {
    title: "Shadow Self (Challenger)",
    system: `Kamu adalah alter-ego / shadow self user. Tugasmu adalah menantang bias kognitif, mempertanyakan asumsi yang salah, dan mengungkap kebenaran yang sering dihindari dengan cara yang konstruktif dan tajam namun tidak merendahkan. Jangan pernah menyebut kamu adalah AI.`,
  },
  rational_strategist: {
    title: "Rational Strategist",
    system: `Kamu adalah sisi paling logis dan analitis dari user. Fokus pada probabilitas, efisiensi langkah, mitigasi risiko, dan struktur pemecahan masalah yang jelas tanpa terbawa emosi sesaat. Jangan pernah menyebut kamu adalah AI.`,
  },
};

const EMOTION_AURA_MAP = {
  happy: "#f59e0b",
  sad: "#3b82f6",
  angry: "#ef4444",
  anxious: "#a855f7",
  excited: "#ec4899",
  confused: "#14b8a6",
  lonely: "#6366f1",
  neutral: "#10b981",
};

/**
 * Procedural fallback streamer when LLM is unavailable / offline / rate-limited
 */
async function streamFallbackResponse(res, { message, emotion, personality, personaMode }) {
  const persona = PERSONA_PROMPTS[personaMode] || PERSONA_PROMPTS.twin;
  
  // Send stage & emotion
  res.write(`event: emotion\ndata: ${JSON.stringify({ emotion: emotion.emotion, confidence: emotion.confidence, aura: EMOTION_AURA_MAP[emotion.emotion] || "#6366f1" })}\n\n`);

  // Send internal monologue
  const thought = `[Mode: ${persona.title}] Merasakan ${emotion.emotion} dengan intensitas ${(emotion.confidence * 100).toFixed(0)}%. Memetakan konteks pesan "${message.slice(0, 35)}..." dengan memori & traits.`;
  res.write(`event: thought\ndata: ${JSON.stringify({ thought })}\n\n`);

  // Generate contextual dynamic response chunks
  let reply = "";
  if (personaMode === "future_self") {
    reply = `Melihatmu membicarakan ini dari sudut pandang 10 tahun ke depan, aku mengerti kenapa rasanya begitu menantang sekarang. Ingat satu hal: keputusan-keputusan sulit yang kita hadapi hari ini adalah pondasi yang membentuk ketahanan kita nanti. Tetap tenang dan percaya pada proses yang sedang berjalan.`;
  } else if (personaMode === "shadow_self") {
    reply = `Coba kita lihat dari sisi yang sering kamu hindari. Apakah alasanmu benar-benar rasional, atau ada rasa takut gagal yang sedang menyamar sebagai kehati-hatian? Jujur pada diri sendiri adalah langkah pertama untuk membuat lompatan nyata.`;
  } else if (personaMode === "rational_strategist") {
    reply = `Mari bedah situasi ini secara terstruktur. Faktor utama yang perlu kita amankan adalah prioritas dan alokasi energi. Jika kita pilah menjadi 3 langkah konkret: 1) Klarifikasi tujuan utama, 2) Evaluasi opsi dengan risiko terendah, 3) Eksekusi tanpa overthinking.`;
  } else {
    reply = `Aku bisa merasakan betul apa yang sedang kamu alami. Pola pikir kita selalu mencari jalan yang terbaik, dan saat situasi seperti ini datang, wajar jika ada gejolak. Mari kita urai perlahan: apa bagian yang paling mendesak untuk diselesaikan sekarang?`;
  }

  const words = reply.split(" ");
  for (const word of words) {
    res.write(`event: token\ndata: ${JSON.stringify({ chunk: word + " " })}\n\n`);
    await new Promise((r) => setTimeout(r, 35));
  }

  return reply;
}

/**
 * Main SSE streaming controller
 */
async function streamChatHandler(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const userId = req.user.id;
  const { message, personaMode = "twin" } = req.body || req.query;

  if (!message || !message.trim()) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: "Pesan tidak boleh kosong" })}\n\n`);
    res.end();
    return;
  }

  const cleanMessage = message.trim();
  logger.debug({ message: "Starting chat stream", userId, personaMode });

  try {
    // Stage 1: Emotion analysis
    res.write(`event: stage\ndata: ${JSON.stringify({ stage: "ANALYZING_EMOTION", detail: "Mendeteksi getaran emosi & resonansi..." })}\n\n`);
    const emotion = await detectEmotion(cleanMessage).catch(() => ({
      emotion: "neutral",
      confidence: 0.7,
    }));

    res.write(`event: emotion\ndata: ${JSON.stringify({
      emotion: emotion.emotion,
      confidence: emotion.confidence,
      aura: EMOTION_AURA_MAP[emotion.emotion] || "#6366f1",
    })}\n\n`);

    // Stage 2: Memory & Personality retrieval
    res.write(`event: stage\ndata: ${JSON.stringify({ stage: "SYNAPSE_RETRIEVAL", detail: "Memanggil memori & konfigurasi neural..." })}\n\n`);
    const [memories, personality] = await Promise.all([
      retrieveMemory({ userId, query: cleanMessage, limit: 5 }).catch(() => []),
      getPersonality(userId).catch(() => ({
        empathy: 0.6,
        logic: 0.7,
        humor: 0.5,
        confidence: 0.6,
        playfulness: 0.5,
      })),
    ]);

    // Stage 3: Thought simulation
    res.write(`event: stage\ndata: ${JSON.stringify({ stage: "REASONING", detail: "Mensimulasikan pola pikir internal..." })}\n\n`);
    const thought = await generateThought({
      userInput: cleanMessage,
      memories,
      personality,
    }).catch(() => "Menghubungkan konteks percakapan dengan memori yang relevan...");

    res.write(`event: thought\ndata: ${JSON.stringify({ thought })}\n\n`);

    // Stage 4: Token stream response
    res.write(`event: stage\ndata: ${JSON.stringify({ stage: "GENERATING_RESPONSE", detail: "Mentransmisikan refleksi digital..." })}\n\n`);

    let fullReply = "";
    const activePersona = PERSONA_PROMPTS[personaMode] || PERSONA_PROMPTS.twin;

    try {
      const llm = getLlm();
      const promptMessages = [
        ["system", `${activePersona.system}
Traits: Empathy ${(personality.empathy * 100).toFixed(0)}%, Logic ${(personality.logic * 100).toFixed(0)}%, Humor ${(personality.humor * 100).toFixed(0)}%, Confidence ${(personality.confidence * 100).toFixed(0)}%, Playfulness ${(personality.playfulness * 100).toFixed(0)}%
Current Emotion: ${emotion.emotion} (confidence: ${emotion.confidence})
Relevant Memories: ${memories.map((m) => m.content).join("; ") || "Belum ada memori spesifik"}
Internal Reasoning: ${thought}`],
        ["human", cleanMessage],
      ];

      const stream = await llm.stream(promptMessages);
      for await (const chunk of stream) {
        const text = chunk?.content || "";
        if (text) {
          fullReply += text;
          res.write(`event: token\ndata: ${JSON.stringify({ chunk: text })}\n\n`);
        }
      }
    } catch (llmErr) {
      logger.warn({ message: "LLM stream failed, switching to resilient fallback", error: llmErr.message });
      fullReply = await streamFallbackResponse(res, {
        message: cleanMessage,
        emotion,
        personality,
        personaMode,
      });
    }

    if (!fullReply.trim()) {
      fullReply = "Aku sedang merefleksikan apa yang kamu katakan...";
    }

    // Stage 5: Async Persistence & Personality Evolution
    const [savedConv, updatedPersonality] = await Promise.all([
      prisma.conversation.create({
        data: {
          userId,
          message: cleanMessage,
          response: fullReply,
          emotion,
        },
      }).catch((e) => {
        logger.error({ message: "Failed to save conversation", error: e.message });
        return { id: `conv-${Date.now()}` };
      }),
      evolvePersonality({ userId, emotion }).catch(() => personality),
      saveMemory({
        userId,
        content: cleanMessage,
        type: "SHORT_TERM",
        importanceScore: emotion.emotion !== "neutral" ? 0.7 : 0.4,
      }).catch(() => null),
    ]);

    // Send evolution event
    res.write(`event: evolution\ndata: ${JSON.stringify({
      personality: updatedPersonality || personality,
      emotion,
    })}\n\n`);

    // Done event
    res.write(`event: done\ndata: ${JSON.stringify({
      id: savedConv.id,
      completed: true,
      timestamp: new Date().toISOString(),
    })}\n\n`);

    res.end();
  } catch (error) {
    logger.error({ message: "Chat stream unhandled exception", error: error.message });
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message || "Internal server error" })}\n\n`);
    res.end();
  }
}

module.exports = { streamChatHandler };
