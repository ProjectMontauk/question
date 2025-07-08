import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Record a new trade
    try {
      console.log('Trade API called with method:', req.method);
      console.log('Trade API request headers:', req.headers);
      console.log('Trade API request body:', req.body);
      
      const {
        walletAddress,
        marketTitle,
        marketId,
        outcome,
        shares,
        avgPrice,
        betAmount,
        toWin,
        status
      } = req.body;
      
      if (!walletAddress || !marketTitle || !marketId || !outcome || !shares || !avgPrice || !betAmount || !toWin) {
        console.error('Missing required fields:', { walletAddress, marketTitle, marketId, outcome, shares, avgPrice, betAmount, toWin });
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      console.log('Creating trade with data:', {
        walletAddress,
        marketTitle,
        marketId,
        outcome,
        shares,
        avgPrice,
        betAmount,
        toWin,
        status: status || 'OPEN',
      });
      
      const trade = await prisma.trade.create({
        data: {
          walletAddress,
          marketTitle,
          marketId: marketId as string,
          outcome,
          shares,
          avgPrice,
          betAmount,
          toWin,
          status: status || 'OPEN',
        },
      });
      
      console.log('Trade created successfully:', trade);
      return res.status(201).json(trade);
    } catch (error) {
      console.error('Error creating trade:', error);
      console.error('Request body:', req.body);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      return res.status(500).json({ error: 'Failed to create trade' });
    }
  } else if (req.method === 'GET') {
    // Fetch all trades for a user
    try {
      const { walletAddress } = req.query;
      if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'Missing walletAddress' });
      }
      const trades = await prisma.trade.findMany({
        where: { walletAddress },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(trades);
    } catch (error) {
      console.error('Error fetching trades:', error);
      return res.status(500).json({ error: 'Failed to fetch trades' });
    }
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 