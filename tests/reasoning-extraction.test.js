"use strict";

const { extractReasoning, extractReasoningFromChunk } = require("../app/services/response");

describe("Native reasoning extraction", () => {
  it("extracts reasoning_content from additional_kwargs on a complete message", () => {
    const msg = {
      content: "Halo, twin.",
      additional_kwargs: { reasoning_content: "User minta sapaan, jawab singkat." },
    };
    expect(extractReasoning(msg)).toBe("User minta sapaan, jawab singkat.");
  });

  it("falls back to reasoning field when reasoning_content absent", () => {
    const msg = {
      content: "Hai.",
      additional_kwargs: { reasoning: "Reasoning field." },
    };
    expect(extractReasoning(msg)).toBe("Reasoning field.");
  });

  it("extracts reasoning block from content array", () => {
    const msg = {
      content: [
        { type: "reasoning", reasoning: "Block-based reasoning." },
        { type: "text", text: "Final answer." },
      ],
    };
    expect(extractReasoning(msg)).toBe("Block-based reasoning.");
  });

  it("returns null when no reasoning present", () => {
    const msg = { content: "Just text", additional_kwargs: {} };
    expect(extractReasoning(msg)).toBeNull();
  });

  it("extracts reasoning delta from a streaming chunk", () => {
    const chunk = {
      content: "token",
      additional_kwargs: { reasoning_content: "incremental " },
    };
    expect(extractReasoningFromChunk(chunk)).toBe("incremental ");
  });

  it("returns null from a chunk with no reasoning content", () => {
    const chunk = { content: "x", additional_kwargs: {} };
    expect(extractReasoningFromChunk(chunk)).toBeNull();
  });

  it("returns null for null/invalid input", () => {
    expect(extractReasoning(null)).toBeNull();
    expect(extractReasoning(undefined)).toBeNull();
    expect(extractReasoningFromChunk(null)).toBeNull();
  });
});
