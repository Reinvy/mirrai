"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../config/db");
const { AppError } = require("../../utils/app-error");
const { savePersonalitySnapshot } = require("../personality/personality-service");

const SALT_ROUNDS = 12;

async function register(name, password) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      password: hashedPassword,
      personality: {
        create: {
          empathy: 0.5,
          logic: 0.5,
          humor: 0.5,
          confidence: 0.5,
          playfulness: 0.5,
        },
      },
    },
    select: { id: true, name: true, createdAt: true },
  });

  await savePersonalitySnapshot(user.id, {
    empathy: 0.5,
    logic: 0.5,
    humor: 0.5,
    confidence: 0.5,
    playfulness: 0.5,
  });

  return user;
}

async function login(name, password) {
  const user = await prisma.user.findFirst({
    where: { name: name.trim(), deletedAt: null },
  });

  if (!user) {
    throw new AppError(401, "Nama atau password salah");
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new AppError(401, "Nama atau password salah");
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION ?? "8h" },
  );

  return { token, user: { id: user.id, name: user.name } };
}

async function logout(token) {
  await prisma.tokenBlacklist.create({ data: { token } });
}

async function changePassword(userId, oldPassword, newPassword) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, password: true },
  });
  if (!user) {
    throw new AppError(404, "User tidak ditemukan");
  }

  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) {
    throw new AppError(401, "Password lama salah");
  }

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password AND increment tokenVersion to invalidate all existing tokens
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashed,
      tokenVersion: { increment: 1 },
    },
  });

  return { message: "Password berhasil diubah. Silakan login ulang." };
}

async function deleteAccount(userId) {
  const now = new Date();
  // Soft-delete the user; cascade to personality, memories, conversations, threads, history
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deletedAt: now },
    });
    await tx.personality.updateMany({
      where: { userId },
      data: { deletedAt: now },
    });
    await tx.personalityHistory.updateMany({
      where: { userId },
      data: { deletedAt: now },
    });
    await tx.memory.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.conversation.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.thread.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    });
  });
}

async function exportUserData(userId) {
  const [user, personality, memories, threads, conversations, personalityHistory] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.personality.findUnique({ where: { userId } }),
      prisma.memory.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.thread.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          conversations: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.conversation.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.personalityHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    personality,
    personalityHistory,
    memories,
    conversations,
    threads,
  };
}

module.exports = {
  register,
  login,
  logout,
  changePassword,
  deleteAccount,
  exportUserData,
};
