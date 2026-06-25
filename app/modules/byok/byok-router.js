"use strict";

const express = require("express");
const { ByokValidation } = require("./byok-validation");
const {
  getByokController,
  putByokController,
  deleteByokController,
  testByokController,
} = require("./byok-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

router.use(tokenVerify);

/**
 * @openapi
 * /byok:
 *   get:
 *     tags: [BYOK]
 *     summary: Get current BYOK config (API key is masked)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: BYOK status
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             enabled: { type: boolean }
 *             baseUrl: { type: string, nullable: true }
 *             model: { type: string, nullable: true }
 *             apiKeyMasked: { type: string, nullable: true }
 *             thinkingEnabled: { type: boolean }
 *             visionEnabled: { type: boolean }
 *       401: { description: Unauthorized }
 */
router.get("/", getByokController);

/**
 * @openapi
 * /byok:
 *   put:
 *     tags: [BYOK]
 *     summary: Set or update BYOK config (OpenAI-compatible)
 *     description: |
 *       Simpan baseUrl, apiKey, dan model milik user. Semua request LLM
 *       untuk user ini akan diarahkan ke provider pilihan user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             enabled: { type: boolean, default: true }
 *             baseUrl:
 *               type: string
 *               example: https://api.openai.com/v1
 *             apiKey:
 *               type: string
 *               description: Di-encrypt saat disimpan. Tidak akan dikembalikan penuh.
 *             model:
 *               type: string
 *               example: gpt-4o-mini
 *             thinkingEnabled:
 *               type: boolean
 *               default: false
 *               description: Aktifkan native model thinking (reasoning_content). Hanya untuk model yang mendukung (o1/o3, DeepSeek R1, dll).
 *             visionEnabled:
 *               type: boolean
 *               default: false
 *               description: Aktifkan dukungan lampiran gambar (vision). Hanya untuk model multimodal.
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Validasi gagal
 *       401: { description: Unauthorized }
 */
router.put("/", ByokValidation.validatePutConfig, putByokController);

/**
 * @openapi
 * /byok:
 *   delete:
 *     tags: [BYOK]
 *     summary: Disable BYOK and remove stored config
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: BYOK disabled }
 *       401: { description: Unauthorized }
 */
router.delete("/", deleteByokController);

/**
 * @openapi
 * /byok/test:
 *   post:
 *     tags: [BYOK]
 *     summary: Test BYOK connection with provided credentials
 *     description: |
 *       Panggil LLM dengan konfigurasi yang diberikan (tanpa menyimpan).
 *       Berguna untuk verifikasi sebelum enable BYOK.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [baseUrl, apiKey, model]
 *             properties:
 *               baseUrl: { type: string }
 *               apiKey: { type: string }
 *               model: { type: string }
 *     responses:
 *       200:
 *         description: Test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 latencyMs: { type: integer }
 *                 sample: { type: string }
 *                 error: { type: string, nullable: true }
 *       401: { description: Unauthorized }
 */
router.post("/test", ByokValidation.validateTestConnection, testByokController);

module.exports = router;
