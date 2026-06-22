"use strict";

const express = require("express");
const { PersonalityValidation } = require("./personality-validation");
const {
  getPersonalityController,
  updatePersonalityController,
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

module.exports = router;
