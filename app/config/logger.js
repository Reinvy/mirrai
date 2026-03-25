"use strict";

const winston = require("winston");
require("winston-daily-rotate-file");

const { combine, timestamp, json, colorize, simple } = winston.format;

const fileTransport = new winston.transports.DailyRotateFile({
  filename: "logs/app-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
  format: combine(timestamp(), json()),
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    }),
    fileTransport,
  ],
});

module.exports = { logger };
