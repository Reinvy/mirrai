"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { ChatValidation } = require("./chat-validation");
const { chatController, chatHistoryController } = require("./chat-controller");
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
 *     description: Mengembalikan daftar percakapan user secara terpaginasi, diurutkan dari yang terbaru.
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
 *                       createdAt: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *       Menjalankan pipeline 8 langkah:
 *       1. Deteksi emosi
 *       2. Ambil memory relevan (semantic search)
 *       3. Load personality snapshot
 *       4. Generate internal reasoning
 *       5. Generate personalized response
 *       6. Simpan conversation
 *       7. Simpan memory baru
 *       8. Update personality (self-evolution)
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
 *     responses:
 *       200:
 *         description: Respons berhasil dihasilkan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Pesan kosong
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/",
  tokenVerify,
  chatRateLimiter,
  ChatValidation.validateChat,
  chatController,
);

module.exports = router;
