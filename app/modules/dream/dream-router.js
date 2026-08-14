"use strict";

const express = require("express");
const {
  consolidateController,
  dailyResonanceController,
  dreamJournalController,
} = require("./dream-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

router.post("/consolidate", tokenVerify, consolidateController);
router.get("/daily-resonance", tokenVerify, dailyResonanceController);
router.get("/journal", tokenVerify, dreamJournalController);

module.exports = router;
