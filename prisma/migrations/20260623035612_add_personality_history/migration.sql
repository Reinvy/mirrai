-- CreateTable
CREATE TABLE "PersonalityHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "empathy" DOUBLE PRECISION NOT NULL,
    "logic" DOUBLE PRECISION NOT NULL,
    "humor" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "playfulness" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalityHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PersonalityHistory" ADD CONSTRAINT "PersonalityHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
