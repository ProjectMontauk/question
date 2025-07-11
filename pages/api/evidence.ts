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

  if (req.method === 'GET') {
    // Get marketId from query parameters
    const { marketId } = req.query;
    
    console.log('Evidence API called with marketId:', marketId);
    
    if (!marketId || typeof marketId !== 'string') {
      console.error('Missing or invalid marketId:', marketId);
      return res.status(400).json({ error: 'Missing or invalid marketId parameter' });
    }
    
    // Fetch evidence for the specific market, ordered by netVotes descending
    try {
      console.log('Querying database for marketId:', marketId);
      const evidence = await prisma.evidence.findMany({
        where: { marketId },
        orderBy: { netVotes: 'desc' }
      });
      console.log('Found evidence count:', evidence.length);
      res.status(200).json(evidence);
    } catch (error) {
      console.error('Failed to fetch evidence:', error);
      res.status(500).json({ error: 'Failed to fetch evidence' });
    }
    return;
  }
  if (req.method === 'POST') {
    // Create new evidence with marketId
    const { marketId, type, title, url, description, walletAddress } = req.body;
    
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid marketId' });
    }
    
    try {
      const evidence = await prisma.evidence.create({
        data: { marketId, type, title, url, description, walletAddress, netVotes: 0 },
      });
      res.status(201).json(evidence);
    } catch (error) {
      console.error('Failed to create evidence:', error);
      res.status(500).json({ error: 'Failed to create evidence' });
    }
  } else if (req.method === 'PATCH') {
    // Update netVotes
    const { id, netVotes } = req.body;
    try {
      const evidence = await prisma.evidence.update({
        where: { id },
        data: { netVotes },
      });
      res.status(200).json(evidence);
    } catch (error) {
      console.error('Failed to update netVotes:', error);
      res.status(500).json({ error: 'Failed to update netVotes' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
