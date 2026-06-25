"use strict";

jest.mock("../app/config/openai", () => {
  const { Runnable } = require("@langchain/core/runnables");
  const { AIMessageChunk } = require("@langchain/core/messages");

  const fakeText = "Hai, Bro Programmer.";

  class FakeLlm extends Runnable {
    lc_namespace = ["fake"];

    async *stream() {
      for (const ch of fakeText) {
        yield new AIMessageChunk(ch);
      }
    }

    async *_streamIterator() {
      yield* this.stream();
    }

    async invoke() {
      return new AIMessageChunk(fakeText);
    }
  }

  return { getLlm: () => new FakeLlm() };
});

const { streamChat, streamWithImages } = require("../app/llm/chains/chat-chain");

describe("chat-chain streamChat", () => {
  const baseInput = {
    userInput: "test",
    personality: "empathy: 50%",
    emotion: "neutral (confidence: 0.5)",
    memories: "none",
    reasoning: "none",
  };

  it("yields deltas verbatim when LLM streams one char at a time (regression for garbled output bug)", async () => {
    const deltas = [];
    for await (const d of streamChat(baseInput)) {
      deltas.push(d);
    }
    expect(deltas.join("")).toBe("Hai, Bro Programmer.");
    expect(deltas.length).toBe(20);
  });
});

describe("chat-chain streamWithImages", () => {
  it("yields deltas verbatim when LLM streams one char at a time (regression for garbled output bug)", async () => {
    const { Runnable } = require("@langchain/core/runnables");
    const { AIMessageChunk } = require("@langchain/core/messages");

    const fakeText = "Hai, Bro Programmer.";

    class FakeImgLlm extends Runnable {
      lc_namespace = ["fake-img"];

      async *stream() {
        for (const ch of fakeText) {
          yield new AIMessageChunk(ch);
        }
      }

      async *_streamIterator() {
        yield* this.stream();
      }

      async invoke() {
        return new AIMessageChunk(fakeText);
      }
    }

    const openaiConfig = require("../app/config/openai");
    const originalGetLlm = openaiConfig.getLlm;
    openaiConfig.getLlm = () => new FakeImgLlm();

    try {
      const deltas = [];
      for await (const d of streamWithImages({
        systemMessage: "system",
        userText: "halo",
        attachments: [],
      })) {
        deltas.push(d);
      }
      expect(deltas.join("")).toBe(fakeText);
    } finally {
      openaiConfig.getLlm = originalGetLlm;
    }
  });
});
