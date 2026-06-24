"use strict";

const express = require("express");
const { MemoryValidation } = require("./memory-validation");
const {
  getMemoriesController,
  createMemoryController,
  updateMemoryController,
  deleteMemoryController,
  memoryInsightsController,
} = require("./memory-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

/**
 * @openapi
 * /memory/{userId}:
 *   get:
 *     tags: [Memory]
 *     summary: Ambil semua memory user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID (harus sesuai dengan token)
 *     responses:
 *       200:
 *         description: List memory berhasil diambil
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", tokenVerify, getMemoriesController);
router.get("/:userId", tokenVerify, getMemoriesController);

/**
 * @openapi
 * /memory:
 *   post:
 *     tags: [Memory]
 *     summary: Simpan memory baru
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content, type]
 *             properties:
 *               content:
 *                 type: string
 *                 example: Aku suka kopi di pagi hari
 *               type:
 *                 type: string
 *                 enum: [SHORT_TERM, LONG_TERM, SEMANTIC, EMOTIONAL]
 *               importanceScore:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *     responses:
 *       201:
 *         description: Memory berhasil disimpan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Memory'
 *       400:
 *         description: Validasi gagal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/",
  tokenVerify,
  MemoryValidation.validateCreate,
  createMemoryController,
);

router.put(
  "/:memoryId",
  tokenVerify,
  MemoryValidation.validateUpdate,
  updateMemoryController,
);

router.delete(
  "/:memoryId",
  tokenVerify,
  deleteMemoryController,
);

/**
 * @openapi
 * /memory/insights:
 *   get:
 *     tags: [Memory]
 *     summary: Statistik memories (count by type, top important, dll)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Memory insights }
 */
router.get("/insights", tokenVerify, memoryInsightsController);

module.exports = router;
