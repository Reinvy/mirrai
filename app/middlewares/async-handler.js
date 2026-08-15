"use strict";

/**
 * Express 4 does not forward rejected promises from async route handlers,
 * which turns every async throw into an unhandled rejection (crashing the
 * Node process on modern Node). Wrap async handlers so rejections flow into
 * the error handler instead.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
