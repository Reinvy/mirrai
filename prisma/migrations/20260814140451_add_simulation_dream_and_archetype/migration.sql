-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('CORE_BELIEF', 'EXPERIENCE', 'RELATIONSHIP', 'GOAL_FEAR', 'DAILY_HABIT', 'PHILOSOPHY');

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN     "associations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "category" "MemoryCategory" NOT NULL DEFAULT 'EXPERIENCE',
ADD COLUMN     "emotionalValence" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE "Personality" ADD COLUMN     "archetype" TEXT DEFAULT 'The Dynamic Reflector';

-- CreateTable
CREATE TABLE "SimulationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "branches" JSONB NOT NULL,
    "consensus" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyResonance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "theme" TEXT NOT NULL,
    "reflection" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "moodAura" TEXT NOT NULL DEFAULT '#6366f1',
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DailyResonance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyResonance_userId_date_idx" ON "DailyResonance"("userId", "date");

-- CreateIndex
CREATE INDEX "Memory_userId_importanceScore_idx" ON "Memory"("userId", "importanceScore");

-- CreateIndex
CREATE INDEX "Memory_userId_category_idx" ON "Memory"("userId", "category");

-- AddForeignKey
ALTER TABLE "SimulationSession" ADD CONSTRAINT "SimulationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyResonance" ADD CONSTRAINT "DailyResonance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
