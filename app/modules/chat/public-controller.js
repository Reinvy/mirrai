"use strict";

const { getSharedThread } = require("./thread-service");
const { prisma } = require("../../config/db");
const { formatSuccessResponse } = require("../../utils/response-formatter");
const { AppError } = require("../../utils/app-error");

const TRAITS = ["empathy", "logic", "humor", "confidence", "playfulness"];

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
            deletedAt: true,
          },
        },
      },
    });
    if (!user) {
      throw new AppError(404, "Profile tidak ditemukan atau private");
    }
    const { personality, ...rest } = user;
    const data = {
      ...rest,
      personality:
        personality && !personality.deletedAt
          ? {
              empathy: personality.empathy,
              logic: personality.logic,
              humor: personality.humor,
              confidence: personality.confidence,
              playfulness: personality.playfulness,
            }
          : null,
    };
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Public profile", data }));
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
        conversations: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });
    const data = threads.map(({ conversations, ...thread }) => ({
      ...thread,
      conversationCount: conversations.length,
    }));
    res
      .status(200)
      .json(formatSuccessResponse({ message: "Public threads", data }));
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
    const selection = {
      name: true,
      bio: true,
      personality: {
        select: {
          empathy: true,
          logic: true,
          humor: true,
          confidence: true,
          playfulness: true,
          deletedAt: true,
        },
      },
    };
    const [a, b] = await Promise.all([
      prisma.user.findFirst({
        where: { name: u1, isPublicProfile: true, deletedAt: null },
        select: selection,
      }),
      prisma.user.findFirst({
        where: { name: u2, isPublicProfile: true, deletedAt: null },
        select: selection,
      }),
    ]);
    if (!a || !b) {
      throw new AppError(404, "Salah satu profile private atau tidak ditemukan");
    }

    const stripDeleted = (personality) =>
      personality && !personality.deletedAt
        ? Object.fromEntries(TRAITS.map((t) => [t, personality[t]]))
        : null;

    const cleanA = { name: a.name, bio: a.bio, personality: stripDeleted(a.personality) };
    const cleanB = { name: b.name, bio: b.bio, personality: stripDeleted(b.personality) };

    const diff = {};
    for (const t of TRAITS) {
      if (cleanA.personality && cleanB.personality) {
        diff[t] =
          Math.round((cleanA.personality[t] - cleanB.personality[t]) * 100) / 100;
      } else {
        diff[t] = 0;
      }
    }
    res.status(200).json(
      formatSuccessResponse({
        message: "Compare",
        data: { u1: cleanA, u2: cleanB, diff },
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
