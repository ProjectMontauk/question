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
    try {
      // Fetch all market ideas, ordered by netVotes descending
      const marketIdeas = await prisma.marketIdea.findMany({
        orderBy: { netVotes: 'desc' }
      });
      
      res.status(200).json(marketIdeas);
    } catch (error) {
      console.error('Failed to fetch market ideas:', error);
      res.status(500).json({ error: 'Failed to fetch market ideas' });
    }
  } else if (req.method === 'POST') {
    // Create new market idea
    const { title, description, rules, walletAddress } = req.body;
    
    if (!title || !walletAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
      const marketIdea = await prisma.marketIdea.create({
        data: { 
          title, 
          description, 
          rules, 
          walletAddress, 
          netVotes: 0,
          status: 'pending'
        },
      });
      
      res.status(201).json(marketIdea);
    } catch (error) {
      console.error('Failed to create market idea:', error);
      res.status(500).json({ error: 'Failed to create market idea' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 