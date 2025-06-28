-- CreateTable
CREATE TABLE "UserPnLHistory" (
    "id" SERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPnLHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPnLHistory_walletAddress_idx" ON "UserPnLHistory"("walletAddress");

-- CreateIndex
CREATE INDEX "UserPnLHistory_timestamp_idx" ON "UserPnLHistory"("timestamp");
