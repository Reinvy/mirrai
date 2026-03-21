"use strict";

const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");
const { embeddings } = require("./embedding");
const { pool } = require("./db");

let vectorstore = null;

async function getVectorStore() {
  if (vectorstore) return vectorstore;

  vectorstore = await PGVectorStore.initialize(embeddings, {
    pool,
    tableName: "langchain_pg_embeddings",
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
    distanceStrategy: "cosine",
  });

  return vectorstore;
}

module.exports = { getVectorStore };
