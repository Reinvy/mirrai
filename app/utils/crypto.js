"use strict";

const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function getKey() {
  const raw = process.env.BYOK_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "BYOK_ENCRYPTION_KEY is required in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
    }
    return null;
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "BYOK_ENCRYPTION_KEY must decode to 32 bytes (base64). Current length: " + buf.length,
    );
  }
  return buf;
}

function encrypt(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    return null;
  }
  const key = getKey();
  if (!key) {
    return plaintext;
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, enc, authTag].map((b) => b.toString("base64")).join(".");
}

function decrypt(encrypted) {
  if (typeof encrypted !== "string" || encrypted.length === 0) {
    return null;
  }
  const key = getKey();
  if (!key) {
    return encrypted;
  }
  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value");
  }
  const iv = Buffer.from(parts[0], "base64");
  const enc = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");
  if (iv.length !== IV_LEN || authTag.length !== AUTH_TAG_LEN) {
    throw new Error("Invalid encrypted payload lengths");
  }
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

function maskApiKey(key) {
  if (typeof key !== "string" || key.length === 0) return null;
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.min(8, key.length - 8)) + key.slice(-4);
}

module.exports = { encrypt, decrypt, maskApiKey };
