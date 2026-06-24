"use strict";

const bcrypt = require("bcrypt");
const { PrismaClient } = require("../app/generated/prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Aborting seed.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const demoName = process.env.SEED_USER_NAME || "demo";
  const demoPassword = process.env.SEED_USER_PASSWORD || "demopassword123";

  console.log(`Seeding demo user "${demoName}"...`);

  // Clean previous demo data (idempotent)
  const existing = await prisma.user.findFirst({ where: { name: demoName } });
  if (existing) {
    console.log("  - removing previous demo user and dependent rows");
    await prisma.personalityHistory.deleteMany({ where: { userId: existing.id } });
    await prisma.memory.deleteMany({ where: { userId: existing.id } });
    await prisma.conversation.deleteMany({ where: { userId: existing.id } });
    await prisma.thread.deleteMany({ where: { userId: existing.id } });
    await prisma.personality.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const hashed = await bcrypt.hash(demoPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: demoName,
      password: hashed,
      personality: {
        create: {
          empathy: 0.6,
          logic: 0.7,
          humor: 0.5,
          confidence: 0.7,
          playfulness: 0.55,
        },
      },
    },
  });

  console.log(`  - created user ${user.id}`);

  await prisma.personalityHistory.create({
    data: {
      userId: user.id,
      empathy: 0.6,
      logic: 0.7,
      humor: 0.5,
      confidence: 0.7,
      playfulness: 0.55,
    },
  });

  // Seed memories
  const memories = [
    {
      content: "Suka kopi hitam tanpa gula di pagi hari",
      type: "SEMANTIC",
      importanceScore: 0.7,
    },
    {
      content: "Lebih produktif di pagi hari, sering kerja setelah subuh",
      type: "SEMANTIC",
      importanceScore: 0.8,
    },
    {
      content: "Suka musik lo-fi saat bekerja",
      type: "SEMANTIC",
      importanceScore: 0.5,
    },
    {
      content: "Sedang belajar Rust untuk side project",
      type: "LONG_TERM",
      importanceScore: 0.7,
    },
    {
      content: "Punya alergi seafood (udang & kepiting)",
      type: "SEMANTIC",
      importanceScore: 0.9,
    },
    {
      content: "Baru saja launching project baru minggu lalu",
      type: "SHORT_TERM",
      importanceScore: 0.6,
    },
    {
      content: "Merasa cemas tentang deadline bulan depan",
      type: "EMOTIONAL",
      importanceScore: 0.7,
    },
  ];

  for (const m of memories) {
    await prisma.memory.create({
      data: { userId: user.id, ...m },
    });
  }
  console.log(`  - created ${memories.length} memories`);

  // Seed one thread + a welcome conversation
  const thread = await prisma.thread.create({
    data: { userId: user.id, title: "Selamat Datang" },
  });

  await prisma.conversation.create({
    data: {
      userId: user.id,
      threadId: thread.id,
      message: "Halo Mirrai, perkenalkan dirimu sebentar.",
      response:
        "Halo! Aku Mirrai, digital twin kamu. Aku bakal belajar dari caramu bicara dan berevolusi seiring waktu. Yuk mulai!",
      reasoning:
        "User minta perkenalan. Aku respond dengan自我介绍 singkat, posisi sebagai digital twin, dan ajakan untuk mulai ngobrol. Tone hangat tapi tidak lebay.",
      emotion: { emotion: "happy", confidence: 0.8 },
    },
  });

  console.log(`  - created welcome thread + conversation`);
  console.log("");
  console.log("Seed complete.");
  console.log(`  Login: name="${demoName}" password="${demoPassword}"`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
