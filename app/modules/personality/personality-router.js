"use strict";

const express = require("express");
const { PersonalityValidation } = require("./personality-validation");
const {
  getPersonalityController,
  updatePersonalityController,
  getPersonalityHistoryController,
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
  getPersonalityController,
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
