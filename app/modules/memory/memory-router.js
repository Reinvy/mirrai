"use strict";

const express = require("express");
const { MemoryValidation } = require("./memory-validation");
const {
  getMemoriesController,
  getMemoryGraphController,
  createMemoryController,
  updateMemoryController,
  deleteMemoryController,
  memoryInsightsController,
  memoryGraphController,
} = require("./memory-controller");
const { tokenVerify } = require("../../middlewares/token-verify");
const { formatSuccessResponse } = require("../../utils/response-formatter");

const router = express.Router();

router.get("/graph/:userId", tokenVerify, getMemoryGraphController);

/**
 * @openapi
 * /memory/me:
 *   get:
 *     tags: [Memory]
 *     summary: Ambil semua memory user saat ini
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List memory berhasil diambil
 *       401:
 *         description: Unauthorized
 */
router.get("/me", tokenVerify, getMemoriesController);

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

/**
 * @openapi
 * /memory/graph:
 *   get:
 *     tags: [Memory]
 *     summary: Graph memori berdasarkan embedding similarity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: threshold
 *         schema: { type: number, default: 0.75, minimum: 0.5, maximum: 0.99 }
 *     responses:
 *       "200":
 *         description: nodes + edges
 */
router.get("/graph", tokenVerify, memoryGraphController);

router.get("/:userId", tokenVerify, getMemoriesController);

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
 * /memory/tune:
 *   post:
 *     tags: [Memory]
 *     summary: Trigger memory importance auto-tune (manual)
 *     description: Biasanya jalan weekly via background job. Endpoint ini untuk manual trigger.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Result }
 */
router.post("/tune", tokenVerify, async (req, res, next) => {
  try {
    const { tuneMemoryImportanceForUser } = require("../../services/memory-tuning");
    const result = await tuneMemoryImportanceForUser(req.credentials.id);
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Memory tuning selesai", data: result }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
