"use strict";

const express = require("express");
const {
  branchSimulationController,
  councilDebateController,
  getUserSimulationsController,
} = require("./simulation-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

router.post("/branch", tokenVerify, branchSimulationController);
router.post("/council", tokenVerify, councilDebateController);
router.get("/", tokenVerify, getUserSimulationsController);

module.exports = router;
