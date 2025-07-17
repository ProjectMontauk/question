-- CreateTable
CREATE TABLE "UserDeposits" (
    "id" SERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDeposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDeposits_walletAddress_idx" ON "UserDeposits"("walletAddress");

-- CreateIndex
CREATE INDEX "UserDeposits_createdAt_idx" ON "UserDeposits"("createdAt");
