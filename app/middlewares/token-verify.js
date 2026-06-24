"use strict";

const jwt = require("jsonwebtoken");
const { prisma } = require("../config/db");
const { AppError } = require("../utils/app-error");

async function tokenVerify(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "Token tidak ditemukan");
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new AppError(401, "Token tidak valid atau sudah kadaluarsa");
    }

    // Validate user still exists, not soft-deleted, and tokenVersion matches
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new AppError(401, "Token tidak valid atau sudah kadaluarsa");
    }
    if (
      typeof decoded.tokenVersion !== "number" ||
      decoded.tokenVersion !== user.tokenVersion
    ) {
      throw new AppError(401, "Token sudah tidak valid");
    }

    // Check blacklist
    const blacklisted = await prisma.tokenBlacklist.findUnique({
      where: { token },
    });
    if (blacklisted) {
      throw new AppError(401, "Token sudah tidak valid");
    }

    req.credentials = {
      id: decoded.id,
      name: decoded.name,
      tokenVersion: decoded.tokenVersion,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { tokenVerify };
