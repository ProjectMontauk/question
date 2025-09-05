import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.thecitizen.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const { walletAddress } = req.query;
    
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid wallet address' });
    }
    
    try {
      // Get all votes by this user for market ideas
      const userVotes = await prisma.marketIdeaVote.findMany({
        where: { 
          walletAddress
        },
        select: {
          ideaId: true,
          voteWeight: true,
          createdAt: true
        }
      });
      
      res.status(200).json(userVotes);
    } catch (error) {
      console.error('Failed to fetch user votes:', error);
      res.status(500).json({ error: 'Failed to fetch user votes' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 