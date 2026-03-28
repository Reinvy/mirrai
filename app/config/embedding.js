"use strict";

const { Embeddings } = require("@langchain/core/embeddings");

const MODEL = "nomic-ai/nomic-embed-text-v1.5";

class LocalEmbeddings extends Embeddings {
  constructor() {
    super({});
    this._pipeline = null;
  }

  async _getPipeline() {
    if (!this._pipeline) {
      const { pipeline } = await import("@huggingface/transformers");
      this._pipeline = await pipeline("feature-extraction", MODEL, {
        dtype: "int8",
      });
    }
    return this._pipeline;
  }

  async embedDocuments(texts) {
    const pipe = await this._getPipeline();
    const results = [];
    for (const text of texts) {
      const output = await pipe("search_document: " + text, {
        pooling: "mean",
        normalize: true,
      });
      results.push(Array.from(output.data));
    }
    return results;
  }

  async embedQuery(text) {
    const pipe = await this._getPipeline();
    const output = await pipe("search_query: " + text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }
}

let _embeddings = null;

function getEmbeddings() {
  if (!_embeddings) {
    _embeddings = new LocalEmbeddings();
  }
  return _embeddings;
}

module.exports = { getEmbeddings };
