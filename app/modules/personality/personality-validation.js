"use strict";

const { AppError } = require("../../utils/app-error");

class PersonalityValidation {
  static validateGetByUser(req, res, next) {
    if (!req.params.userId) {
      throw new AppError(400, "userId diperlukan");
    }
    next();
  }
}

module.exports = { PersonalityValidation };
