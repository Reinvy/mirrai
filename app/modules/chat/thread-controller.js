"use strict";

const {
  createThread,
  getThreadsByUser,
  updateThread,
  deleteThread,
} = require("./thread-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function createThreadController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { title } = req.body;
    const thread = await createThread(userId, title);
    res.status(201).json(
      formatSuccessResponse({
        message: "Thread berhasil dibuat",
        data: thread,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function getThreadsController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const threads = await getThreadsByUser(userId);
    res.status(200).json(
      formatSuccessResponse({
        message: "Daftar thread berhasil diambil",
        data: threads,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function updateThreadController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { threadId } = req.params;
    const { title } = req.body;
    const thread = await updateThread(threadId, userId, { title });
    res.status(200).json(
      formatSuccessResponse({
        message: "Judul thread berhasil diperbarui",
        data: thread,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function deleteThreadController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { threadId } = req.params;
    await deleteThread(threadId, userId);
    res.status(200).json(
      formatSuccessResponse({
        message: "Thread berhasil dihapus",
      }),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createThreadController,
  getThreadsController,
  updateThreadController,
  deleteThreadController,
};
