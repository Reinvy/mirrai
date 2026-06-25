"use strict";

const { AppError } = require("../../utils/app-error");

const MAX_MESSAGE_LEN = 4000;
const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB after base64
const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

class ChatValidation {
  static validateChat(req, res, next) {
    const { message, attachments } = req.body;
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      throw new AppError(400, "Pesan tidak boleh kosong");
    }
    if (message.length > MAX_MESSAGE_LEN) {
      throw new AppError(400, `Pesan terlalu panjang (maks ${MAX_MESSAGE_LEN} karakter)`);
    }
    if (attachments !== undefined) {
      if (!Array.isArray(attachments)) {
        throw new AppError(400, "attachments harus berupa array");
      }
      if (attachments.length > MAX_ATTACHMENTS) {
        throw new AppError(
          400,
          `Maksimal ${MAX_ATTACHMENTS} lampiran per pesan`,
        );
      }
      for (const att of attachments) {
        if (!att || typeof att !== "object") {
          throw new AppError(400, "Lampiran tidak valid");
        }
        if (att.type !== "image") {
          throw new AppError(400, "Tipe lampiran tidak didukung");
        }
        if (typeof att.dataUrl !== "string" || !att.dataUrl.startsWith("data:")) {
          throw new AppError(400, "dataUrl lampiran tidak valid");
        }
        const mimeMatch = att.dataUrl.match(/^data:([^;]+);base64,/);
        if (!mimeMatch || !ALLOWED_IMAGE_MIME.has(mimeMatch[1])) {
          throw new AppError(
            400,
            `Tipe gambar tidak didukung. Boleh: ${[...ALLOWED_IMAGE_MIME].join(", ")}`,
          );
        }
        if (att.mimeType !== undefined) {
          if (typeof att.mimeType !== "string" || !ALLOWED_IMAGE_MIME.has(att.mimeType)) {
            throw new AppError(
              400,
              `mimeType lampiran tidak valid. Boleh: ${[...ALLOWED_IMAGE_MIME].join(", ")}`,
            );
          }
          if (att.mimeType !== mimeMatch[1]) {
            throw new AppError(400, "mimeType lampiran tidak cocok dengan dataUrl");
          }
        }
        // Approximate size: base64 length * 3/4
        const base64Length = att.dataUrl.length - mimeMatch[0].length;
        const approxBytes = (base64Length * 3) / 4;
        if (approxBytes > MAX_IMAGE_BYTES) {
          throw new AppError(400, "Ukuran gambar terlalu besar (maks 5MB)");
        }
      }
    }
    next();
  }
  static validateGetHistory(req, res, next) {
    const { page, limit } = req.query;
    if (
      page !== undefined &&
      (isNaN(parseInt(page, 10)) || parseInt(page, 10) < 1)
    ) {
      throw new AppError(400, "Parameter page harus berupa angka positif");
    }
    if (
      limit !== undefined &&
      (isNaN(parseInt(limit, 10)) ||
        parseInt(limit, 10) < 1 ||
        parseInt(limit, 10) > 100)
    ) {
      throw new AppError(400, "Parameter limit harus antara 1 dan 100");
    }
    next();
  }
}

module.exports = { ChatValidation };

