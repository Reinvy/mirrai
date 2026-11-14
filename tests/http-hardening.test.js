"use strict";

require("./setup");

const request = require("supertest");
const express = require("express");
const { errorHandler } = require("../app/middlewares/error-handler");
const app = require("../app");

describe("HTTP hardening", () => {
  describe("CORS", () => {
    it("does not echo an origin outside the allowlist", async () => {
      const res = await request(app)
        .get("/api-docs.json")
        .set("Origin", "https://evil.example");
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("allows an allowlisted origin", async () => {
      const res = await request(app)
        .get("/api-docs.json")
        .set("Origin", "http://localhost:3001");
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3001");
    });
  });

  describe("Body parsing", () => {
    it("returns 400 (not 500) for malformed JSON", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send("{ this is not json");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ status: "error", message: "Body JSON tidak valid" });
    });

    it("maps oversized bodies to 413 without leaking a stack", async () => {
      const tiny = express();
      tiny.use(express.json({ limit: "1kb" }));
      tiny.post("/x", (req, res) => res.json({ ok: true }));
      tiny.use(errorHandler);

      const res = await request(tiny)
        .post("/x")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ payload: "x".repeat(4096) }));

      expect(res.status).toBe(413);
      expect(res.body).toEqual({ status: "error", message: "Body terlalu besar" });
      expect(JSON.stringify(res.body)).not.toMatch(/stack/i);
    });
  });

  describe("Onboarding flag", () => {
    it("is exposed on /auth/me and flips after completing onboarding", async () => {
      const name = `onboard_${Date.now().toString(36)}`;
      await request(app).post("/api/auth/register").send({ name, password: "testpass123" });
      const login = await request(app)
        .post("/api/auth/login")
        .send({ name, password: "testpass123" });
      const token = login.body.data.token;

      const before = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(before.status).toBe(200);
      expect(before.body.data.onboardingCompleted).toBe(false);

      const complete = await request(app)
        .post("/api/personality/me/onboarding")
        .set("Authorization", `Bearer ${token}`);
      expect(complete.status).toBe(200);
      expect(complete.body.data.onboardingCompleted).toBe(true);

      const after = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(after.body.data.onboardingCompleted).toBe(true);
    });

    it("requires authentication", async () => {
      const res = await request(app).post("/api/personality/me/onboarding");
      expect(res.status).toBe(401);
    });
  });

  describe("Error handler", () => {
    it("closes the connection instead of writing headers twice", () => {
      const headersSentResponse = {
        headersSent: true,
        status: jest.fn(),
        json: jest.fn(),
      };
      const next = jest.fn();
      errorHandler(new Error("late failure"), { path: "/x", method: "GET" }, headersSentResponse, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(headersSentResponse.status).not.toHaveBeenCalled();
      expect(headersSentResponse.json).not.toHaveBeenCalled();
    });

    it("returns 502 for upstream provider errors", () => {
      const response = {
        headersSent: false,
        statusCode: 0,
        payload: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.payload = body;
          return this;
        },
      };
      errorHandler(
        Object.assign(new Error("bad gateway payload"), {
          name: "APIError",
          status: 400,
          headers: {},
        }),
        { path: "/x", method: "POST" },
        response,
        jest.fn(),
      );
      expect(response.statusCode).toBe(502);
      expect(response.payload.message).toMatch(/Layanan AI/i);
    });

    it("maps prisma errors without reading prototype keys", () => {
      const response = {
        headersSent: false,
        statusCode: 0,
        payload: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.payload = body;
          return this;
        },
      };
      errorHandler(
        Object.assign(new Error("dup"), { code: "P2002" }),
        { path: "/x", method: "POST" },
        response,
        jest.fn(),
      );
      expect(response.statusCode).toBe(409);

      errorHandler(
        Object.assign(new Error("weird"), { code: "toString" }),
        { path: "/x", method: "POST" },
        response,
        jest.fn(),
      );
      expect(response.statusCode).toBe(500);
    });
  });
});
