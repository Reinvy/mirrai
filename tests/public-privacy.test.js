"use strict";

require("./setup");

const request = require("supertest");
const { prisma } = require("../app/config/db");
const app = require("../app");

describe("Public data exposure", () => {
  const suffix = Date.now().toString(36);
  const ownerName = `privacy_owner_${suffix}`;
  const otherName = `privacy_other_${suffix}`;
  let ownerToken;
  let ownerId;
  let slug;

  beforeAll(async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: ownerName, password: "testpass123" });
    await request(app)
      .post("/api/auth/register")
      .send({ name: otherName, password: "testpass123" });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ name: ownerName, password: "testpass123" });
    ownerToken = login.body.data.token;
    ownerId = login.body.data.user.id;

    await request(app)
      .put("/api/auth/me/profile")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ isPublicProfile: true, bio: "Bio rahasia yang tidak boleh bocor di share" });

    const thread = await request(app)
      .post("/api/chat/threads")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Thread publik" });
    const threadId = thread.body.data.id;

    await prisma.conversation.create({
      data: {
        userId: ownerId,
        threadId,
        message: "Halo publik",
        response: "Halo juga",
        emotion: { emotion: "neutral", confidence: 0.9 },
      },
    });

    const shared = await request(app)
      .post(`/api/chat/threads/${threadId}/share`)
      .set("Authorization", `Bearer ${ownerToken}`);
    slug = shared.body.data.shareSlug;
  });

  it("exposes only the author name on a shared thread", async () => {
    const res = await request(app).get(`/api/chat/shared/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ name: ownerName });
    expect(res.body.data).not.toHaveProperty("userId");
    expect(res.body.data).not.toHaveProperty("isPublic");
    expect(res.body.data).not.toHaveProperty("shareSlug");
    expect(res.body.data.conversations).toHaveLength(1);
  });

  it("hides a personality that was soft-deleted", async () => {
    await prisma.personality.update({
      where: { userId: ownerId },
      data: { deletedAt: new Date() },
    });

    const profile = await request(app).get(`/api/chat/users/${ownerName}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.personality).toBeNull();
    expect(profile.body.data).not.toHaveProperty("userId");
    expect(profile.body.data).not.toHaveProperty("id");

    await prisma.personality.update({
      where: { userId: ownerId },
      data: { deletedAt: null },
    });
  });

  it("returns only the five traits in compare", async () => {
    const res = await request(app).get(
      `/api/chat/compare?u1=${ownerName}&u2=${otherName}`,
    );
    // The second account is not public yet.
    expect(res.status).toBe(404);

    await request(app)
      .post("/api/auth/login")
      .send({ name: otherName, password: "testpass123" });
    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({ name: otherName, password: "testpass123" });
    await request(app)
      .put("/api/auth/me/profile")
      .set("Authorization", `Bearer ${otherLogin.body.data.token}`)
      .send({ isPublicProfile: true });

    const ok = await request(app).get(
      `/api/chat/compare?u1=${ownerName}&u2=${otherName}`,
    );
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.body.data.diff).sort()).toEqual(
      ["confidence", "empathy", "humor", "logic", "playfulness"].sort(),
    );
    for (const side of [ok.body.data.u1, ok.body.data.u2]) {
      expect(side).not.toHaveProperty("userId");
      expect(side).not.toHaveProperty("deletedAt");
      expect(side.personality).not.toHaveProperty("deletedAt");
      expect(side.personality).not.toHaveProperty("updatedAt");
    }
  });

  it("unpublishes shared threads when the account is deleted and frees the name", async () => {
    const del = await request(app)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(del.status).toBe(200);

    const shared = await request(app).get(`/api/chat/shared/${slug}`);
    expect(shared.status).toBe(404);

    const profile = await request(app).get(`/api/chat/users/${ownerName}`);
    expect(profile.status).toBe(404);

    const reRegister = await request(app)
      .post("/api/auth/register")
      .send({ name: ownerName, password: "testpass123" });
    expect(reRegister.status).toBe(201);
  });
});
