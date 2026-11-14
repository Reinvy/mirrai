"use strict";

const express = require("express");
const {
  branchSimulationController,
  councilDebateController,
  getUserSimulationsController,
  getSimulationByIdController,
} = require("./simulation-controller");
const { SimulationValidation } = require("./simulation-validation");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

router.post(
  "/branch",
  tokenVerify,
  SimulationValidation.validateBranch,
  branchSimulationController,
);
router.post(
  "/council",
  tokenVerify,
  SimulationValidation.validateCouncil,
  councilDebateController,
);
router.get("/", tokenVerify, getUserSimulationsController);
router.get("/:id", tokenVerify, getSimulationByIdController);

module.exports = router;
