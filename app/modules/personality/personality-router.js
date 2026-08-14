"use strict";

const express = require("express");
const { PersonalityValidation } = require("./personality-validation");
const {
  getPersonalityController,
  getArchetypeController,
} = require("./personality-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

router.get(
  "/archetype/:userId",
  tokenVerify,
  PersonalityValidation.validateGetByUser,
  getArchetypeController,
);

router.get(
  "/:userId",
  tokenVerify,
  PersonalityValidation.validateGetByUser,
  getPersonalityController,
);

module.exports = router;
