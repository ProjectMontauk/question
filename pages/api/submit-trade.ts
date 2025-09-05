import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.thecitizen.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    console.log('Submit Trade API called with method:', req.method);
    console.log('Submit Trade API request headers:', req.headers);
    console.log('Submit Trade API request body:', req.body);
    
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
    
    // Validate required fields
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
    
    // Create the trade record
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
    
    // Return success response
    res.status(201).json({
      success: true,
      data: trade
    });

  } catch (error) {
    console.error('Error in submit-trade API:', error);
    console.error('Request body:', req.body);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    res.status(500).json({ 
      error: 'Failed to create trade',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
