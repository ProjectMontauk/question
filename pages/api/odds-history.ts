import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Add a new odds history entry
    const { outcome, probability, timestamp } = req.body;
    try {
      const entry = await prisma.oddsHistory.create({
        data: {
          outcome,
          probability,
          timestamp: timestamp ? new Date(timestamp) : undefined,
        },
      });
      res.status(201).json(entry);
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch odds history' });
    }
    return;
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
} 