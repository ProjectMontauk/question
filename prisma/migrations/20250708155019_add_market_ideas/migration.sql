-- CreateTable
CREATE TABLE "MarketIdea" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "netVotes" INTEGER NOT NULL DEFAULT 0,
    "walletAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketIdeaVote" (
    "id" SERIAL NOT NULL,
    "ideaId" INTEGER NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "voteWeight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketIdeaVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketIdea_walletAddress_idx" ON "MarketIdea"("walletAddress");

-- CreateIndex
CREATE INDEX "MarketIdea_status_idx" ON "MarketIdea"("status");

-- CreateIndex
CREATE INDEX "MarketIdeaVote_ideaId_idx" ON "MarketIdeaVote"("ideaId");

-- CreateIndex
CREATE INDEX "MarketIdeaVote_walletAddress_idx" ON "MarketIdeaVote"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "MarketIdeaVote_ideaId_walletAddress_key" ON "MarketIdeaVote"("ideaId", "walletAddress");

-- AddForeignKey
ALTER TABLE "MarketIdeaVote" ADD CONSTRAINT "MarketIdeaVote_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "MarketIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
