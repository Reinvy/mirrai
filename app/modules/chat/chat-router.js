"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { ChatValidation } = require("./chat-validation");
const {
  chatController,
  chatHistoryController,
  playgroundController,
  getConversationByIdController,
} = require("./chat-controller");
const { chatStreamController } = require("./chat-stream-controller");
const {
  createThreadController,
  getThreadsController,
  updateThreadController,
  deleteThreadController,
  shareThreadController,
  unshareThreadController,
} = require("./thread-controller");
const {
  getPublicProfileController,
  getPublicThreadsController,
  getSharedThreadController,
  compareController,
} = require("./public-controller");
const {
  chatInsightsController,
  moodTimelineController,
} = require("./insights-controller");
const { recapController } = require("./recap-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

// Public, unauthenticated routes MUST come before any `/:param` routes
// to prevent Express from matching them as conversationId/threadId.
router.get("/shared/:slug", getSharedThreadController);
router.get("/users/:username", getPublicProfileController);
router.get("/users/:username/threads", getPublicThreadsController);
router.get("/compare", compareController);

const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Terlalu banyak request. Coba lagi dalam 1 menit.",
  },
});
const threadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Terlalu banyak request. Coba lagi sebentar lagi.",
  },
});

/**
 * @openapi
 * /chat:
 *   get:
 *     tags: [Chat]
 *     summary: Ambil riwayat chat user
 *     description: Mengembalikan daftar percakapan user secara terpaginasi, diurutkan dari yang terbaru. Bisa difilter per threadId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Halaman yang ingin diambil
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Jumlah item per halaman
 *       - in: query
 *         name: threadId
 *         schema:
 *           type: string
 *         description: ID thread percakapan
 *     responses:
 *       200:
 *         description: Riwayat chat berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalPages: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       message: { type: string }
 *                       response: { type: string }
 *                       emotion: { type: object }
 *                       threadId: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  tokenVerify,
  ChatValidation.validateGetHistory,
  chatHistoryController,
);

/**
 * @openapi
 * /chat:
 *   post:
 *     tags: [Chat]
 *     summary: Kirim pesan dan dapatkan respons dari MirrAI
 *     description: |
 *       Menjalankan pipeline 8 langkah dan mengasosiasikannya dengan thread percakapan.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: Aku lagi mikirin soal masa depan nih
 *               threadId:
 *                 type: string
 *                 description: Opsional. Jika kosong, thread baru akan dibuat otomatis.
 *     responses:
 *       200:
 *         description: Respons berhasil dihasilkan
 *       400:
 *         description: Pesan kosong
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  tokenVerify,
  chatRateLimiter,
  ChatValidation.validateChat,
  chatController,
);

/**
 * @openapi
 * /chat/playground:
 *   post:
 *     tags: [Chat]
 *     summary: Kirim pesan simulasi Digital Twin vs Asisten AI Standard
 *     description: |
 *       Menjalankan simulasi ephemeral (sementara) membandingkan Digital Twin dengan Asisten AI Standard.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: Aku merasa sangat tertekan dengan pekerjaan baruku
 *     responses:
 *       200:
 *         description: Simulasi berhasil diselesaikan
 *       400:
 *         description: Pesan kosong
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/playground",
  tokenVerify,
  chatRateLimiter,
  ChatValidation.validateChat,
  playgroundController,
);

/**
 * @openapi
 * /chat/stream:
 *   post:
 *     tags: [Chat]
 *     summary: Kirim pesan dengan streaming response (Server-Sent Events)
 *     description: |
 *       Sama seperti POST /chat, tapi response di-stream per token via SSE.
 *       Event sequence: meta → reasoning → delta* → done
 *       Setiap event: `data: {json}\n\n`
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *               threadId:
 *                 type: string
 *                 description: Opsional. Jika kosong, thread baru dibuat otomatis.
 *     responses:
 *       200:
 *         description: Stream terbuka
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Pesan kosong
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit
 */
router.post(
  "/stream",
  tokenVerify,
  chatRateLimiter,
  ChatValidation.validateChat,
  chatStreamController,
);

/**
 * @openapi
 * /chat/insights:
 *   get:
 *     tags: [Chat]
 *     summary: Statistik & ringkasan chat user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Insights berhasil diambil
 */
router.get("/insights", tokenVerify, chatInsightsController);

/**
 * @openapi
 * /chat/mood-timeline:
 *   get:
 *     tags: [Chat]
 *     summary: Timeline emosi harian (default 30 hari)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, maximum: 90, default: 30 }
 *     responses:
 *       200: { description: Mood timeline }
 */
router.get("/mood-timeline", tokenVerify, moodTimelineController);

/**
 * @openapi
 * /chat/recap:
 *   get:
 *     tags: [Chat]
 *     summary: Recap percakapan (LLM-generated summary)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, enum: [7, 30, 90], default: 7 }
 *     responses:
 *       200: { description: Recap generated }
 */
router.get("/recap", tokenVerify, recapController);

/**
 * @openapi
 * /chat/threads:
 *   get:
 *     tags: [Chat Threads]
 *     summary: Ambil daftar thread percakapan milik user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar thread berhasil diambil
 */
router.get(
  "/threads",
  tokenVerify,
  threadRateLimiter,
  getThreadsController,
);

/**
 * @openapi
 * /chat/threads:
 *   post:
 *     tags: [Chat Threads]
 *     summary: Buat thread percakapan baru
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 default: Percakapan Baru
 *     responses:
 *       201:
 *         description: Thread berhasil dibuat
 */
router.post(
  "/threads",
  tokenVerify,
  threadRateLimiter,
  createThreadController,
);

/**
 * @openapi
 * /chat/threads/{threadId}:
 *   put:
 *     tags: [Chat Threads]
 *     summary: Update judul thread percakapan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Judul thread berhasil diperbarui
 */
router.put(
  "/threads/:threadId",
  tokenVerify,
  threadRateLimiter,
  updateThreadController,
);

/**
 * @openapi
 * /chat/threads/{threadId}:
 *   delete:
 *     tags: [Chat Threads]
 *     summary: Hapus thread percakapan beserta seluruh chat di dalamnya
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thread berhasil dihapus
 */
router.delete(
  "/threads/:threadId",
  tokenVerify,
  threadRateLimiter,
  deleteThreadController,
);

/**
 * @openapi
 * /chat/threads/{threadId}/share:
 *   post:
 *     tags: [Chat Threads]
 *     summary: Buat thread menjadi publik (generate share link)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thread published }
 */
router.post(
  "/threads/:threadId/share",
  tokenVerify,
  shareThreadController,
);

/**
 * @openapi
 * /chat/threads/{threadId}/share:
 *   delete:
 *     tags: [Chat Threads]
 *     summary: Unpublish thread
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Unpublished }
 */
router.delete(
  "/threads/:threadId/share",
  tokenVerify,
  unshareThreadController,
);

/**
 * @openapi
 * /chat/{conversationId}:
 *   get:
 *     tags: [Chat]
 *     summary: Ambil satu conversation by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Conversation }
 *       404: { description: Tidak ditemukan }
 */
router.get(
  "/:conversationId",
  tokenVerify,
  getConversationByIdController,
);

module.exports = router;
