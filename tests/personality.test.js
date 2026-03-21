"use strict";

require("./setup");

const request = require("supertest");
const app = require("../app");

describe("Personality API", () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const name = `personalityuser_${Date.now()}`;
    await request(app)
      .post("/api/auth/register")
      .send({ name, password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ name, password: "testpass123" });
    authToken = loginRes.body.data.token;
    userId = loginRes.body.data.user.id;
  });

  describe("GET /api/personality/:userId", () => {
    it("should return personality with default traits", async () => {
      const res = await request(app)
        .get(`/api/personality/${userId}`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("empathy", 0.5);
      expect(res.body.data).toHaveProperty("logic", 0.5);
      expect(res.body.data).toHaveProperty("humor", 0.5);
      expect(res.body.data).toHaveProperty("confidence", 0.5);
      expect(res.body.data).toHaveProperty("playfulness", 0.5);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request(app).get(`/api/personality/${userId}`);
      expect(res.status).toBe(401);
    });
  });
});
