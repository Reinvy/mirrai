"use strict";

// Set test environment variables before anything imports configs
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.JWT_EXPIRATION = "1h";
process.env.OPENAI_API_KEY = "test-openai-api-key";
process.env.OPENAI_MODEL = "gpt-4o-mini";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/mirrai_test";
process.env.NODE_ENV = "test";

// Mock ESM-only modules for Jest CJS environment
jest.mock("@scalar/express-api-reference", () => ({
  apiReference: () => (req, res, next) => next(),
}));

