import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { walletAddress } = req.query;
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid walletAddress' });
    }

    try {
      // Fetch PnL history for the wallet address, ordered by oldest first
      const pnlHistory = await prisma.userPnLHistory.findMany({
        where: { walletAddress },
        orderBy: { timestamp: 'asc' }, // chronological order
        take: 50 // Limit to last 50 entries
      });

      res.status(200).json(pnlHistory);
    } catch (error) {
      console.error('Error fetching PnL history:', error);
      res.status(500).json({ error: 'Failed to fetch PnL history' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
