"use strict";

const express = require("express");
const { AuthValidation } = require("./auth-validation");
const {
  registerController,
  loginController,
  logoutController,
  meController,
  changePasswordController,
  deleteAccountController,
  exportAccountController,
  updateProfileController,
} = require("./auth-controller");
const { tokenVerify } = require("../../middlewares/token-verify");

const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Daftar akun baru
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: mirrauser
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: secret123
 *     responses:
 *       201:
 *         description: Registrasi berhasil
 *       400:
 *         description: Validasi gagal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Nama sudah digunakan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/register", AuthValidation.validateRegister, registerController);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login dan dapatkan JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: mirrauser
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login berhasil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Nama atau password salah
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/login", AuthValidation.validateLogin, loginController);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout dan invalidasi token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout berhasil
 *       401:
 *         description: Token tidak valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/logout", tokenVerify, logoutController);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Ambil data user yang sedang login
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data user berhasil diambil
 *       401:
 *         description: Token tidak valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", tokenVerify, meController);

/**
 * @openapi
 * /auth/password:
 *   put:
 *     tags: [Auth]
 *     summary: Ubah password (akan invalidate semua token lain)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password berhasil diubah }
 *       401: { description: Password lama salah }
 */
router.put("/password", tokenVerify, changePasswordController);

/**
 * @openapi
 * /auth/me:
 *   delete:
 *     tags: [Auth]
 *     summary: Hapus akun (soft delete + cascade)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Akun dihapus }
 */
router.delete("/me", tokenVerify, deleteAccountController);

/**
 * @openapi
 * /auth/me/export:
 *   get:
 *     tags: [Auth]
 *     summary: Export semua data user sebagai JSON
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: JSON dump
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get("/me/export", tokenVerify, exportAccountController);

/**
 * @openapi
 * /auth/me/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update bio & public profile flag
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPublicProfile: { type: boolean }
 *               bio: { type: string, maxLength: 280 }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put("/me/profile", tokenVerify, updateProfileController);

module.exports = router;
