import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    const { marketId, yesProbability, noProbability, timestamp } = req.body;

    // Validate required fields
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid marketId' });
    }

    if (yesProbability === undefined || noProbability === undefined) {
      return res.status(400).json({ error: 'Missing probability values' });
    }

    // Record odds directly to database
    try {
      const result = await prisma.oddsHistory.create({
        data: {
          marketId,
          yesProbability: Number(yesProbability),
          noProbability: Number(noProbability),
          timestamp: timestamp ? new Date(timestamp) : new Date()
        }
      });
      
      console.log('Successfully recorded odds:', result);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Failed to record odds:', error);
      res.status(500).json({ 
        error: 'Failed to record odds to database',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error in record-odds API:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
