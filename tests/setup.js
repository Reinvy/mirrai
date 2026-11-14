require("dotenv").config();

// Set test environment variables before anything imports configs
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.JWT_EXPIRATION = "1h";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai-api-key";
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/mirrai_test";
process.env.NODE_ENV = "test";
// Tests must never reach a real BYOK host; the URL safety layer stays strict.
delete process.env.BYOK_ALLOW_PRIVATE_HOSTS;
delete process.env.BYOK_ENCRYPTION_KEY;

// Mock ESM-only modules for Jest CJS environment
jest.mock("@scalar/express-api-reference", () => ({
  apiReference: () => (req, res, next) => next(),
}));

const mockEmbeddingDim = 768;

function mockHashVector(text) {
  const vector = new Array(mockEmbeddingDim).fill(0);
  const tokens = String(text)
    .replace(/^(search_document|search_query):\s*/i, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    vector[Math.abs(hash) % mockEmbeddingDim] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

// Deterministic, offline embeddings. Loading the real 768-d model in every
// suite would download hundreds of MB and make cosine similarity untestable.
jest.mock("../app/config/embedding", () => ({
  getEmbeddings: () => ({
    embedDocuments: async (texts) => texts.map((text) => mockHashVector(text)),
    embedQuery: async (text) => mockHashVector(text),
  }),
}));

const { prisma, pool } = require("../app/config/db");

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (pool) {
    await pool.end();
  }
});
