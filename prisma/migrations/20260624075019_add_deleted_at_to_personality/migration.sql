-- AlterTable
ALTER TABLE "Personality" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PersonalityHistory" ADD COLUMN     "deletedAt" TIMESTAMP(3);
