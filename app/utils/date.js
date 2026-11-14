"use strict";

/**
 * Local-time day helpers.
 *
 * Daily buckets (chat activity, mood timeline, dream journal keys, quota reset)
 * must follow the user's local midnight. Using ISO strings here would shift
 * every bucket by the UTC offset.
 */

function pad(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function localDateKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

module.exports = { startOfDay, localDateKey };
