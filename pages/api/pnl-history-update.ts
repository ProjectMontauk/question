import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { readContract } from "thirdweb";
import { client } from "../../src/client";
import { polygonAmoy } from "thirdweb/chains";

const prisma = new PrismaClient();

// Get the market contract instance
const marketContractAddress = "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a" as `0x${string}`;
const marketContract = {
  client,
  chain: polygonAmoy,
  address: marketContractAddress,
};

// Function to fetch current price for a given outcome from the smart contract
async function getCurrentPrice(outcome: string): Promise<number> {
  try {
    let oddsResult;
    
    if (outcome.toLowerCase().includes('yes')) {
      // Fetch odds for Yes (outcome 0)
      oddsResult = await readContract({
        contract: marketContract,
        method: "function odds(uint256 _outcome) view returns (int128)",
        params: [0n],
      });
    } else if (outcome.toLowerCase().includes('no')) {
      // Fetch odds for No (outcome 1)
      oddsResult = await readContract({
        contract: marketContract,
        method: "function odds(uint256 _outcome) view returns (int128)",
        params: [1n],
      });
    } else {
      // Default fallback
      return 0;
    }
    
    // Convert odds to price (same logic as portfolio page)
    return Number(oddsResult) / Math.pow(2, 64);
  } catch (error) {
    console.error('Error fetching current price for outcome:', outcome, error);
    // Fallback to 0 if contract call fails
    return 0;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.tinfoilnews.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Missing walletAddress' });

  // Fetch all trades for the user
  const trades = await prisma.trade.findMany({ where: { walletAddress } });

  let pnl = 0;
  for (const trade of trades) {
    // Fetch the current price for this trade's outcome
    const currentPrice = await getCurrentPrice(trade.outcome);
    pnl += (trade.shares * currentPrice) - trade.betAmount;
  }

  // Insert new PnL history row
  const record = await prisma.userPnLHistory.create({
    data: { walletAddress, pnl }
  });

  res.status(200).json(record);
} 