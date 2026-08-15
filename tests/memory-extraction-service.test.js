"use strict";

// Unit tests for the normalize/validate logic in app/services/memory-extraction.
// Runs in isolation (no supertest, no DB, no app boot) to avoid module-cache
// conflicts with the chat-pipeline integration tests in
// tests/memory-extraction.test.js.

describe("Memory extraction service normalization", () => {
  let extractMemories;
  let MAX_EXTRACTIONS;

  const loadServiceWithChainMock = (chainImpl) => {
    jest.resetModules();
    const chainPath = require.resolve("../app/llm/chains/memory-extraction-chain");
    jest.doMock(chainPath, () => ({
      memoryExtractionChain: { invoke: chainImpl },
    }));
    const mod = require("../app/services/memory-extraction");
    extractMemories = mod.extractMemories;
    MAX_EXTRACTIONS = mod.MAX_EXTRACTIONS;
  };

  it("drops invalid types, clamps score, caps at 3 items, dedupes content", async () => {
    loadServiceWithChainMock(async () => ({
      memories: [
        { content: "A", type: "SEMANTIC", importanceScore: 0.5 },
        { content: "B", type: "LONG_TERM", importanceScore: 0.7 },
        { content: "C", type: "EMOTIONAL", importanceScore: 1.5 },
        { content: "D", type: "EMOTIONAL", importanceScore: -0.5 },
        { content: "A", type: "SEMANTIC", importanceScore: 0.9 },
        { content: "E", type: "BLAHBLAH", importanceScore: 0.6 },
        { content: "", type: "SEMANTIC", importanceScore: 0.6 },
        { content: "F", type: "LONG_TERM", importanceScore: 0.7 },
        { content: "G", type: "SEMANTIC", importanceScore: 0.7 },
      ],
    }));

    const result = await extractMemories({
      userInput: "anything",
      emotion: { emotion: "happy", confidence: 0.8 },
    });

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.content)).toEqual(["A", "B", "C"]);
    expect(MAX_EXTRACTIONS).toBe(3);
    expect(result[2].importanceScore).toBe(1.0);
    expect(result[1].importanceScore).toBeCloseTo(0.7);
  });

  it("returns empty array when chain throws", async () => {
    loadServiceWithChainMock(async () => {
      throw new Error("LLM down");
    });

    const result = await extractMemories({
      userInput: "hi",
      emotion: { emotion: "neutral", confidence: 0.5 },
    });
    expect(result).toEqual([]);
  });

  it("returns empty array when chain returns object without memories array", async () => {
    loadServiceWithChainMock(async () => ({ memories: null }));

    const result = await extractMemories({
      userInput: "x",
      emotion: { emotion: "neutral", confidence: 0.5 },
    });
    expect(result).toEqual([]);
  });
});
