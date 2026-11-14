"use strict";

const express = require("express");
const { PersonalityValidation } = require("./personality-validation");
const {
  getPersonalityController,
  getArchetypeController,
  updatePersonalityController,
  getPersonalityHistoryController,
  getPersonalityInsightsController,
  resetPersonalityController,
  completeOnboardingController,
} = require("./personality-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

/**
 * @openapi
 * /personality/me:
 *   get:
 *     tags: [Personality]
 *     summary: Ambil state personality user saat ini
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personality berhasil diambil
 *       401:
 *         description: Unauthorized
 */
router.get("/me", tokenVerify, getPersonalityController);

/**
 * @openapi
 * /personality/me:
 *   put:
 *     tags: [Personality]
 *     summary: Update trait personality (partial)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               empathy: { type: number, minimum: 0.1, maximum: 1 }
 *               logic: { type: number, minimum: 0.1, maximum: 1 }
 *               humor: { type: number, minimum: 0.1, maximum: 1 }
 *               confidence: { type: number, minimum: 0.1, maximum: 1 }
 *               playfulness: { type: number, minimum: 0.1, maximum: 1 }
 *     responses:
 *       200: { description: Personality diperbarui }
 *       400: { description: Nilai tidak valid }
 */
router.put(
  "/me",
  tokenVerify,
  PersonalityValidation.validateUpdate,
  updatePersonalityController,
);

/**
 * @openapi
 * /personality/me/archetype:
 *   get:
 *     tags: [Personality]
 *     summary: Hitung dan simpan archetype kognitif user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Archetype }
 */
router.get("/me/archetype", tokenVerify, getArchetypeController);

router.get("/me/history", tokenVerify, getPersonalityHistoryController);

/**
 * @openapi
 * /personality/me/insights:
 *   get:
 *     tags: [Personality]
 *     summary: Ringkasan personality + tren 7 hari
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: summary
 *         schema: { type: string, enum: ["0", "1"], default: "0" }
 *         description: "1 = generate ringkasan naratif via LLM (cached 10 menit)"
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

/**
 * @openapi
 * /personality/me/onboarding:
 *   post:
 *     tags: [Personality]
 *     summary: Tandai onboarding personality selesai
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Onboarding selesai }
 */
router.post("/me/onboarding", tokenVerify, completeOnboardingController);

module.exports = router;
