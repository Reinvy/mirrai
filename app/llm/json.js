"use strict";

/**
 * Extract the first balanced JSON object/array from an LLM response.
 *
 * A greedy regex like /\{[\s\S]*\}/ spans from the first "{"" to the last "}"
 * and breaks as soon as the model writes prose around the payload or emits two
 * objects. This walks the string and tracks string/escape state instead.
 */
function extractFirstJson(text) {
  const source = String(text ?? "");
  let start = -1;
  let openChar = "";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (start === -1) {
      if (ch === "{" || ch === "[") {
        start = i;
        openChar = ch;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === openChar) {
      depth += 1;
    } else if (ch === (openChar === "{" ? "}" : "]")) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error("No JSON found in LLM output");
}

function parseLlmJson(text) {
  return JSON.parse(extractFirstJson(text));
}

module.exports = { extractFirstJson, parseLlmJson };
