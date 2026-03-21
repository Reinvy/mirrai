"use strict";

// Set test environment variables before anything imports configs
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.JWT_EXPIRATION = "1h";
process.env.OPENROUTER_API_KEY = "test-openrouter-api-key";
process.env.OPENROUTER_MODEL = "openai/gpt-4o-mini";
process.env.EMBEDDING_MODEL = "openai/text-embedding-3-small";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/mirrai_test";
process.env.NODE_ENV = "test";
