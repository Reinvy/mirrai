"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { ChatValidation } = require("./chat-validation");
const { chatController } = require("./chat-controller");
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
