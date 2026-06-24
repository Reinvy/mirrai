"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { ChatValidation } = require("./chat-validation");
const { chatController, chatHistoryController, playgroundController } = require("./chat-controller");
const {
  createThreadController,
  getThreadsController,
  updateThreadController,
  deleteThreadController,
} = require("./thread-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

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
  deleteThreadController,
);

module.exports = router;
