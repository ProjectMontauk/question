import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    console.log('POST /api/odds-history body:', req.body); // Debug log
    const { marketId, yesProbability, noProbability, timestamp } = req.body;
    
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid marketId' });
    }
    
    try {
      const entry = await prisma.oddsHistory.create({
        data: {
          marketId,
          yesProbability,
          noProbability,
          timestamp: timestamp ? new Date(timestamp) : undefined,
        },
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Failed to create odds history entry:", error);
      res.status(500).json({ error: 'Failed to create odds history entry' });
    }
    return;
  }
  if (req.method === 'GET') {
    // Get marketId from query parameters
    const { marketId } = req.query;
    
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid marketId parameter' });
    }
    
    // Return odds history entries for the specific market, ordered by timestamp ascending
    try {
      const entries = await prisma.oddsHistory.findMany({
        where: { marketId },
        orderBy: { timestamp: 'asc' },
      });
      res.status(200).json(entries);
    } catch (error) {
      console.error("Failed to fetch odds history:", error);
      res.status(500).json({ error: 'Failed to fetch odds history' });
    }
    return;
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
} 