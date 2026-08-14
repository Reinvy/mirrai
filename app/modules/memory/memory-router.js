"use strict";

const express = require("express");
const { MemoryValidation } = require("./memory-validation");
const {
  getMemoriesController,
  getMemoryGraphController,
  createMemoryController,
  deleteMemoryController,
} = require("./memory-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

router.get("/graph/:userId", tokenVerify, getMemoryGraphController);
router.get("/:userId", tokenVerify, getMemoriesController);
router.post("/", tokenVerify, MemoryValidation.validateCreate, createMemoryController);
router.delete("/:id", tokenVerify, deleteMemoryController);

module.exports = router;
