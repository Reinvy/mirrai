"use strict";

const { prisma } = require("../../config/db");
const {
  register,
  login,
  logout,
  changePassword,
  deleteAccount,
  exportUserData,
} = require("./auth-service");
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
      select: {
        id: true,
        name: true,
        bio: true,
        isPublicProfile: true,
        createdAt: true,
      },
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

async function changePasswordController(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || typeof oldPassword !== "string") {
      return res
        .status(400)
        .json({ status: "error", message: "Password lama harus diisi" });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res
        .status(400)
        .json({ status: "error", message: "Password baru minimal 8 karakter" });
    }
    if (newPassword.length > 128) {
      return res
        .status(400)
        .json({ status: "error", message: "Password baru terlalu panjang" });
    }
    const result = await changePassword(
      req.credentials.id,
      oldPassword,
      newPassword,
    );
    res
      .status(200)
      .json(formatSuccessResponse({ message: result.message, data: null }));
  } catch (err) {
    next(err);
  }
}

async function deleteAccountController(req, res, next) {
  try {
    await deleteAccount(req.credentials.id);
    res
      .status(200)
      .json(
        formatSuccessResponse({
          message: "Akun berhasil dihapus",
          data: null,
        }),
      );
  } catch (err) {
    next(err);
  }
}

async function exportAccountController(req, res, next) {
  try {
    const data = await exportUserData(req.credentials.id);
    const filename = `mirrai-export-${data.user?.id || "user"}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(JSON.stringify(data, null, 2));
  } catch (err) {
    next(err);
  }
}

async function updateProfileController(req, res, next) {
  try {
    const { isPublicProfile, bio } = req.body;
    const update = {};
    if (typeof isPublicProfile === "boolean") {
      update.isPublicProfile = isPublicProfile;
    }
    if (bio !== undefined) {
      if (typeof bio !== "string") {
        return res
          .status(400)
          .json({ status: "error", message: "Bio harus berupa string" });
      }
      if (bio.length > 280) {
        return res
          .status(400)
          .json({ status: "error", message: "Bio terlalu panjang (maks 280)" });
      }
      update.bio = bio;
    }
    const user = await prisma.user.update({
      where: { id: req.credentials.id },
      data: update,
      select: {
        id: true,
        name: true,
        bio: true,
        isPublicProfile: true,
        createdAt: true,
      },
    });
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Profile updated", data: user }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerController,
  loginController,
  logoutController,
  meController,
  changePasswordController,
  deleteAccountController,
  exportAccountController,
  updateProfileController,
};
