import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

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

  if (req.method === 'POST') {
    console.log('POST /api/odds-history called');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    
    const { marketId, yesProbability, noProbability, timestamp } = req.body;
    
    if (!marketId || typeof marketId !== 'string') {
      console.error('Missing or invalid marketId:', marketId);
      return res.status(400).json({ error: 'Missing or invalid marketId' });
    }
    
    console.log('Creating odds history entry:', {
      marketId,
      yesProbability,
      noProbability,
      timestamp
    });
    
    try {
      const entry = await prisma.oddsHistory.create({
        data: {
          marketId,
          yesProbability,
          noProbability,
          timestamp: timestamp ? new Date(timestamp) : undefined,
        },
      });
      console.log('Odds history entry created successfully:', entry);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Failed to create odds history entry:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });
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