-- Cognitive OS v2: persona/partial conversations, dream journal, deterministic
-- daily resonance keys, simulation session types, and onboarding flag.

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill onboarding flag for users that already have a non-default personality
UPDATE "User" u
SET "onboardingCompleted" = true
WHERE EXISTS (
    SELECT 1 FROM "Personality" p
    WHERE p."userId" = u.id
      AND p."deletedAt" IS NULL
      AND (p."empathy" <> 0.5 OR p."logic" <> 0.5 OR p."humor" <> 0.5
           OR p."confidence" <> 0.5 OR p."playfulness" <> 0.5)
);

-- AlterTable: Conversation
ALTER TABLE "Conversation" ADD COLUMN "persona" TEXT NOT NULL DEFAULT 'twin',
ADD COLUMN "partial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Memory
ALTER TABLE "Memory" ADD COLUMN "consolidatedAt" TIMESTAMP(3);

-- AlterTable: SimulationSession
ALTER TABLE "SimulationSession" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'branch',
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable: DreamEntry
CREATE TABLE "DreamEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "reflection" TEXT NOT NULL,
    "coreBeliefs" JSONB NOT NULL DEFAULT '[]',
    "consolidatedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DreamEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable: DailyResonance (nullable first so existing rows can be backfilled)
ALTER TABLE "DailyResonance" ADD COLUMN "dayKey" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "DailyResonance" SET "dayKey" = to_char("date", 'YYYY-MM-DD');

-- Drop duplicate (userId, dayKey) rows, keeping the newest per pair
DELETE FROM "DailyResonance" a
USING "DailyResonance" b
WHERE a."userId" = b."userId"
  AND a."dayKey" = b."dayKey"
  AND a.id > b.id;

DELETE FROM "DailyResonance" WHERE "dayKey" IS NULL;

ALTER TABLE "DailyResonance" ALTER COLUMN "dayKey" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Memory_userId_consolidatedAt_idx" ON "Memory"("userId", "consolidatedAt");

-- CreateIndex
CREATE INDEX "SimulationSession_userId_createdAt_idx" ON "SimulationSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DreamEntry_userId_createdAt_idx" ON "DreamEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyResonance_userId_dayKey_key" ON "DailyResonance"("userId", "dayKey");

-- AddForeignKey
ALTER TABLE "DreamEntry" ADD CONSTRAINT "DreamEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
