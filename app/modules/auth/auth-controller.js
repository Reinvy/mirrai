"use strict";

const { prisma } = require("../../config/db");
const { register, login, logout } = require("./auth-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function registerController(req, res, next) {
  try {
    const { name, password } = req.body;
    const user = await register(name, password);
    res
      .status(201)
      .json(
        formatSuccessResponse({ message: "Registrasi berhasil", data: user }),
      );
  } catch (err) {
    next(err);
  }
}

async function loginController(req, res, next) {
  try {
    const { name, password } = req.body;
    const result = await login(name, password);
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Login berhasil", data: result }));
  } catch (err) {
    next(err);
  }
}

async function logoutController(req, res, next) {
  try {
    const token = req.headers.authorization.split(" ")[1];
    await logout(token);
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Logout berhasil", data: null }));
  } catch (err) {
    next(err);
  }
}

async function meController(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.credentials.id },
      select: { id: true, name: true, createdAt: true },
    });
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User tidak ditemukan" });
    }
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Data user", data: user }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerController,
  loginController,
  logoutController,
  meController,
};
