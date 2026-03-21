"use strict";

const { OpenAIEmbeddings } = require("@langchain/openai");

let _embeddings = null;

function getEmbeddings() {
  if (!_embeddings) {
    _embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
      model: process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
    });
  }
  return _embeddings;
}

module.exports = { getEmbeddings };
