-- CreateEnum
CREATE TYPE "EmailBlockReason" AS ENUM ('ACCOUNT_DELETED_BY_ADMIN', 'ACCOUNT_SELF_DELETED');

-- CreateTable
CREATE TABLE "BlockedEmail" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "reason" "EmailBlockReason" NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedEmail_emailHash_key" ON "BlockedEmail"("emailHash");

-- CreateIndex
CREATE INDEX "BlockedEmail_blockedUntil_idx" ON "BlockedEmail"("blockedUntil");

