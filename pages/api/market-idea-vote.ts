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

  if (req.method === 'POST') {
    const { ideaId, walletAddress, voteType } = req.body;
    
    if (!ideaId || !walletAddress || !voteType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (voteType !== 'upvote') {
      return res.status(400).json({ error: 'Only upvotes are allowed' });
    }
    
    try {
      // Use a transaction to ensure data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Check if user has already voted on this idea
        const existingVote = await tx.marketIdeaVote.findUnique({
          where: {
            ideaId_walletAddress: {
              ideaId,
              walletAddress
            }
          }
        });
        
        if (existingVote) {
          // User is toggling their vote off (remove upvote)
          await tx.marketIdeaVote.delete({
            where: { id: existingVote.id }
          });
        } else {
          // User is voting for the first time (add upvote)
          await tx.marketIdeaVote.create({
            data: {
              ideaId,
              walletAddress,
              voteWeight: 1 // Simple 1:1 voting for market ideas
            }
          });
        }
        
        // Calculate new net votes for this idea
        const votes = await tx.marketIdeaVote.findMany({
          where: { ideaId },
          select: { voteWeight: true }
        });
        
        const netVotes = votes.reduce((sum, vote) => sum + vote.voteWeight, 0);
        
        // Update the market idea with new net votes
        await tx.marketIdea.update({
          where: { id: ideaId },
          data: { netVotes }
        });
        
        return { netVotes, action: existingVote ? 'removed' : 'added' };
      });
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Market idea vote error:', error);
      res.status(500).json({ error: 'Failed to process vote', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 