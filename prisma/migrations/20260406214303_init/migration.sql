-- CreateTable
CREATE TABLE "TelegramMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramMessageId" INTEGER NOT NULL,
    "chatId" BIGINT NOT NULL,
    "chatTitle" TEXT,
    "senderUserId" BIGINT NOT NULL,
    "senderUsername" TEXT,
    "messageText" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "telegramDate" DATETIME NOT NULL,
    "projectId" TEXT,
    "projectName" TEXT,
    "assigneeGithubUsername" TEXT,
    "assigneeName" TEXT,
    "classifiedIntent" TEXT,
    "confidence" REAL,
    "extractedKeywords" TEXT,
    "aiDraftJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "issueNumber" INTEGER,
    "issueUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramMessage_telegramMessageId_chatId_key" ON "TelegramMessage"("telegramMessageId", "chatId");
