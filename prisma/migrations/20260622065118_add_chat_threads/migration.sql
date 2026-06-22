-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Percakapan Baru',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "threadId" TEXT;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate data: Create a default thread for each user who has conversations, then assign existing conversations to it
INSERT INTO "Thread" ("id", "title", "userId", "createdAt")
SELECT DISTINCT 'default-thread-' || "userId", 'Arsip Percakapan', "userId", NOW()
FROM "Conversation"
ON CONFLICT ("id") DO NOTHING;

UPDATE "Conversation"
SET "threadId" = 'default-thread-' || "userId"
WHERE "threadId" IS NULL;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

