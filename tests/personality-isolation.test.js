"use strict";

require("./setup");

const request = require("supertest");
const app = require("../app");

describe("Personality isolation", () => {
  let tokenA;
  let userIdA;
  let tokenB;
  let userIdB;

  beforeAll(async () => {
    const nameA = `pers_iso_a_${Date.now().toString(36)}`;
    const nameB = `pers_iso_b_${Date.now().toString(36)}`;
    await request(app).post("/api/auth/register").send({ name: nameA, password: "testpass123" });
    await request(app).post("/api/auth/register").send({ name: nameB, password: "testpass123" });

    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ name: nameA, password: "testpass123" });
    tokenA = loginA.body.data.token;
    userIdA = loginA.body.data.user.id;

    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ name: nameB, password: "testpass123" });
    tokenB = loginB.body.data.token;
    userIdB = loginB.body.data.user.id;
  });

  it("returns own personality via /me", async () => {
    const res = await request(app)
      .get("/api/personality/me")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("empathy", 0.5);
  });

  it("does not expose another user's personality by path", async () => {
    const res = await request(app)
      .get(`/api/personality/${userIdB}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it("does not allow updating another user's personality by path", async () => {
    const res = await request(app)
      .put(`/api/personality/${userIdB}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ empathy: 1 });
    expect(res.status).toBe(404);

    const check = await request(app)
      .get("/api/personality/me")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(check.body.data.empathy).toBe(0.5);
  });

  it("rejects non-numeric trait values", async () => {
    for (const payload of [{ empathy: null }, { empathy: "0.7" }, { logic: 5 }, { humor: 0 }]) {
      const res = await request(app)
        .put("/api/personality/me")
        .set("Authorization", `Bearer ${tokenA}`)
        .send(payload);
      expect(res.status).toBe(400);
    }
  });

  it("rejects an empty trait payload", async () => {
    const res = await request(app)
      .put("/api/personality/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("accepts a valid partial update", async () => {
    const res = await request(app)
      .put("/api/personality/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ empathy: 0.7 });
    expect(res.status).toBe(200);
    expect(res.body.data.empathy).toBe(0.7);
    expect(res.body.data.logic).toBe(0.5);
  });

  it("returns an archetype derived from real data", async () => {
    const res = await request(app)
      .get("/api/personality/me/archetype")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.archetype).toHaveProperty("name");
    expect(typeof res.body.data.stats.cognitiveSyncIndex).toBe("number");
  });

  it("no longer exposes the legacy /archetype/:userId route", async () => {
    const res = await request(app)
      .get(`/api/personality/archetype/${userIdA}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });
});
