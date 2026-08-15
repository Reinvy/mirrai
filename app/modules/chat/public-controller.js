"use strict";

const { getSharedThread } = require("./thread-service");
const { prisma } = require("../../config/db");
const { formatSuccessResponse } = require("../../utils/response-formatter");
const { AppError } = require("../../utils/app-error");

async function getPublicProfileController(req, res, next) {
  try {
    const { username } = req.params;
    const user = await prisma.user.findFirst({
      where: { name: username, isPublicProfile: true, deletedAt: null },
      select: {
        name: true,
        bio: true,
        createdAt: true,
        personality: {
          select: {
            empathy: true,
            logic: true,
            humor: true,
            confidence: true,
            playfulness: true,
          },
        },
      },
    });
    if (!user) {
      throw new AppError(404, "Profile tidak ditemukan atau private");
    }
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Public profile", data: user }));
  } catch (err) {
    next(err);
  }
}

async function getPublicThreadsController(req, res, next) {
  try {
    const { username } = req.params;
    const user = await prisma.user.findFirst({
      where: { name: username, isPublicProfile: true, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new AppError(404, "Profile tidak ditemukan");
    }
    const threads = await prisma.thread.findMany({
      where: { userId: user.id, isPublic: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        shareSlug: true,
        createdAt: true,
        _count: { select: { conversations: true } },
      },
    });
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Public threads", data: threads }));
  } catch (err) {
    next(err);
  }
}

async function getSharedThreadController(req, res, next) {
  try {
    const { slug } = req.params;
    const thread = await getSharedThread(slug);
    if (!thread) {
      throw new AppError(404, "Thread tidak ditemukan");
    }
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Shared thread", data: thread }));
  } catch (err) {
    next(err);
  }
}

async function compareController(req, res, next) {
  try {
    const { u1, u2 } = req.query;
    if (!u1 || !u2) {
      throw new AppError(400, "Parameter u1 dan u2 wajib diisi");
    }
    if (u1 === u2) {
      throw new AppError(400, "Pilih dua user yang berbeda");
    }
    const [a, b] = await Promise.all([
      prisma.user.findFirst({
        where: { name: u1, isPublicProfile: true, deletedAt: null },
        select: {
          name: true,
          bio: true,
          personality: true,
        },
      }),
      prisma.user.findFirst({
        where: { name: u2, isPublicProfile: true, deletedAt: null },
        select: {
          name: true,
          bio: true,
          personality: true,
        },
      }),
    ]);
    if (!a || !b) {
      throw new AppError(404, "Salah satu profile private atau tidak ditemukan");
    }
    const traits = ["empathy", "logic", "humor", "confidence", "playfulness"];
    const diff = {};
    for (const t of traits) {
      if (a.personality && b.personality) {
        diff[t] = Math.round((a.personality[t] - b.personality[t]) * 100) / 100;
      } else {
        diff[t] = 0;
      }
    }
    res.status(200).json(
      formatSuccessResponse({
        message: "Compare",
        data: { u1: a, u2: b, diff },
      }),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicProfileController,
  getPublicThreadsController,
  getSharedThreadController,
  compareController,
};
