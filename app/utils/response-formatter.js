'use strict'

function formatSuccessResponse({ message, data, meta }) {
  if (meta) {
    return { message, meta, data }
  }
  return { message, data }
}

module.exports = { formatSuccessResponse }
