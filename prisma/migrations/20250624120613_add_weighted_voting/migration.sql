-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "evidenceId" INTEGER NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "voteWeight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMarketPosition" (
    "id" SERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "yesShares" INTEGER NOT NULL DEFAULT 0,
    "noShares" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMarketPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_evidenceId_walletAddress_key" ON "Vote"("evidenceId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserMarketPosition_walletAddress_key" ON "UserMarketPosition"("walletAddress");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
