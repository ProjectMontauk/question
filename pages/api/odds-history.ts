import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    console.log('POST /api/odds-history body:', req.body); // Debug log
    const { yesProbability, noProbability, timestamp } = req.body;
    try {
      const entry = await prisma.oddsHistory.create({
        data: {
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
    // Return all odds history entries, ordered by timestamp ascending
    try {
      const entries = await prisma.oddsHistory.findMany({
        orderBy: { timestamp: 'asc' },
      });
      res.status(200).json(entries);
    } catch {
      res.status(500).json({ error: 'Failed to fetch odds history' });
    }
    return;
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
} 