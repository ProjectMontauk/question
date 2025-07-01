/*
  Warnings:

  - A unique constraint covering the columns `[marketId,walletAddress]` on the table `UserMarketPosition` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `marketId` to the `Comment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marketId` to the `CommentVote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marketId` to the `Evidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marketId` to the `OddsHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marketId` to the `UserMarketPosition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marketId` to the `Vote` table without a default value. This is not possible if the table is not empty.

*/

-- DropIndex
DROP INDEX "UserMarketPosition_walletAddress_key";

-- Add marketId columns as nullable first
ALTER TABLE "Comment" ADD COLUMN     "marketId" TEXT;
ALTER TABLE "CommentVote" ADD COLUMN     "marketId" TEXT;
ALTER TABLE "Evidence" ADD COLUMN     "marketId" TEXT;
ALTER TABLE "OddsHistory" ADD COLUMN     "marketId" TEXT;
ALTER TABLE "UserMarketPosition" ADD COLUMN     "marketId" TEXT;
ALTER TABLE "Vote" ADD COLUMN     "marketId" TEXT;

-- Set default marketId for existing records (assuming they belong to the JFK market)
UPDATE "Comment" SET "marketId" = 'jfk' WHERE "marketId" IS NULL;
UPDATE "CommentVote" SET "marketId" = 'jfk' WHERE "marketId" IS NULL;
UPDATE "Evidence" SET "marketId" = 'jfk' WHERE "marketId" IS NULL;
UPDATE "OddsHistory" SET "marketId" = 'jfk' WHERE "marketId" IS NULL;
UPDATE "UserMarketPosition" SET "marketId" = 'jfk' WHERE "marketId" IS NULL;
UPDATE "Vote" SET "marketId" = 'jfk' WHERE "marketId" IS NULL;

-- Make marketId columns NOT NULL
ALTER TABLE "Comment" ALTER COLUMN "marketId" SET NOT NULL;
ALTER TABLE "CommentVote" ALTER COLUMN "marketId" SET NOT NULL;
ALTER TABLE "Evidence" ALTER COLUMN "marketId" SET NOT NULL;
ALTER TABLE "OddsHistory" ALTER COLUMN "marketId" SET NOT NULL;
ALTER TABLE "UserMarketPosition" ALTER COLUMN "marketId" SET NOT NULL;
ALTER TABLE "Vote" ALTER COLUMN "marketId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Trade" ALTER COLUMN "marketId" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Comment_marketId_idx" ON "Comment"("marketId");

-- CreateIndex
CREATE INDEX "CommentVote_marketId_idx" ON "CommentVote"("marketId");

-- CreateIndex
CREATE INDEX "Evidence_marketId_idx" ON "Evidence"("marketId");

-- CreateIndex
CREATE INDEX "Evidence_marketId_type_idx" ON "Evidence"("marketId", "type");

-- CreateIndex
CREATE INDEX "OddsHistory_marketId_idx" ON "OddsHistory"("marketId");

-- CreateIndex
CREATE INDEX "OddsHistory_marketId_timestamp_idx" ON "OddsHistory"("marketId", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_marketId_idx" ON "Trade"("marketId");

-- CreateIndex
CREATE INDEX "UserMarketPosition_marketId_idx" ON "UserMarketPosition"("marketId");

-- CreateIndex
CREATE INDEX "UserMarketPosition_walletAddress_idx" ON "UserMarketPosition"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserMarketPosition_marketId_walletAddress_key" ON "UserMarketPosition"("marketId", "walletAddress");

-- CreateIndex
CREATE INDEX "Vote_marketId_idx" ON "Vote"("marketId");

-- CreateIndex
CREATE INDEX "Vote_walletAddress_idx" ON "Vote"("walletAddress");
