"use strict";

const { AppError } = require("../../utils/app-error");

const MAX_NAME_LEN = 32;
const MAX_PASSWORD_LEN = 128;
const MIN_NAME_LEN = 2;
const MIN_PASSWORD_LEN = 8;

class AuthValidation {
  static validateRegister(req, res, next) {
    const { name, password } = req.body;
    if (!name || typeof name !== "string" || name.trim().length < MIN_NAME_LEN) {
      throw new AppError(400, `Nama harus diisi minimal ${MIN_NAME_LEN} karakter`);
    }
    if (name.length > MAX_NAME_LEN) {
      throw new AppError(400, `Nama terlalu panjang (maks ${MAX_NAME_LEN} karakter)`);
    }
    if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LEN) {
      throw new AppError(400, `Password harus diisi minimal ${MIN_PASSWORD_LEN} karakter`);
    }
    if (password.length > MAX_PASSWORD_LEN) {
      throw new AppError(400, `Password terlalu panjang (maks ${MAX_PASSWORD_LEN} karakter)`);
    }
    next();
  }

  static validateLogin(req, res, next) {
    const { name, password } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new AppError(400, "Nama harus diisi");
    }
    if (name.length > MAX_NAME_LEN) {
      throw new AppError(400, `Nama terlalu panjang (maks ${MAX_NAME_LEN} karakter)`);
    }
    if (!password || typeof password !== "string" || password.length === 0) {
      throw new AppError(400, "Password harus diisi");
    }
    if (password.length > MAX_PASSWORD_LEN) {
      throw new AppError(400, `Password terlalu panjang (maks ${MAX_PASSWORD_LEN} karakter)`);
    }
    next();
  }
}

module.exports = { AuthValidation };
