import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { walletAddress } = req.query;
    
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid wallet address' });
    }
    
    try {
      // Get all votes by this user
      const userVotes = await prisma.vote.findMany({
        where: { walletAddress },
        select: {
          evidenceId: true,
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