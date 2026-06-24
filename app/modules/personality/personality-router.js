"use strict";

const express = require("express");
const { PersonalityValidation } = require("./personality-validation");
const {
  getPersonalityController,
  updatePersonalityController,
  getPersonalityHistoryController,
  getPersonalityInsightsController,
  resetPersonalityController,
} = require("./personality-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

/**
 * @openapi
 * /personality/{userId}:
 *   get:
 *     tags: [Personality]
 *     summary: Ambil state personality user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: Personality berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Personality'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Personality tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/me",
  tokenVerify,
  updatePersonalityController,
);

router.put(
  "/me",
  tokenVerify,
  updatePersonalityController,
);

router.get(
  "/me/history",
  tokenVerify,
  getPersonalityHistoryController,
);

/**
 * @openapi
 * /personality/me/insights:
 *   get:
 *     tags: [Personality]
 *     summary: Ringkasan personality + tren 7 hari
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Personality insights }
 */
router.get("/me/insights", tokenVerify, getPersonalityInsightsController);

/**
 * @openapi
 * /personality/me/reset:
 *   post:
 *     tags: [Personality]
 *     summary: Reset personality ke default 0.5 (simpan snapshot)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Reset berhasil }
 */
router.post("/me/reset", tokenVerify, resetPersonalityController);

router.get(
  "/:userId",
  tokenVerify,
  PersonalityValidation.validateGetByUser,
  getPersonalityController,
);

router.put(
  "/:userId",
  tokenVerify,
  PersonalityValidation.validateGetByUser,
  updatePersonalityController,
);

/**
 * @openapi
 * /personality/{userId}/history:
 *   get:
 *     tags: [Personality]
 *     summary: Ambil riwayat evolusi kepribadian user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Jumlah data snapshot yang ingin diambil
 *     responses:
 *       200:
 *         description: Riwayat kepribadian berhasil diambil
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:userId/history",
  tokenVerify,
  PersonalityValidation.validateGetByUser,
  getPersonalityHistoryController,
);

module.exports = router;
