"use strict";

const {
  consolidateMemories,
  getDailyResonance,
  getDreamJournal,
} = require("./dream-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function consolidateController(req, res, next) {
  try {
    const userId = req.credentials?.id || req.user?.id;
    const result = await consolidateMemories({ userId });
    res.status(200).json(
      formatSuccessResponse({
        message: "Konsolidasi memori bawah sadar berhasil dijalankan",
        data: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function dailyResonanceController(req, res, next) {
  try {
    const userId = req.credentials?.id || req.user?.id;
    const result = await getDailyResonance(userId);
    res.status(200).json(
      formatSuccessResponse({
        message: "Resonansi harian berhasil diambil",
        data: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function dreamJournalController(req, res, next) {
  try {
    const userId = req.credentials?.id || req.user?.id;
    const result = await getDreamJournal(userId);
    res.status(200).json(
      formatSuccessResponse({
        message: "Jurnal mimpi dan refleksi berhasil diambil",
        data: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  consolidateController,
  dailyResonanceController,
  dreamJournalController,
};
