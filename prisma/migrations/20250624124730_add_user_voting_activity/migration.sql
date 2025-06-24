-- CreateTable
CREATE TABLE "UserVotingActivity" (
    "id" SERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVotingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserVotingActivity_walletAddress_evidenceType_key" ON "UserVotingActivity"("walletAddress", "evidenceType");
