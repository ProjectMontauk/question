import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { evidenceId, walletAddress, voteType, evidenceType, marketId } = req.body;
    
    if (!evidenceId || !walletAddress || !voteType || !evidenceType || !marketId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (voteType !== 'upvote') {
      return res.status(400).json({ error: 'Only upvotes are allowed' });
    }
    
    if (!['yes', 'no'].includes(evidenceType)) {
      return res.status(400).json({ error: 'Invalid evidence type' });
    }
    
    try {
      // Use a transaction to ensure data consistency and reduce round trips
      const result = await prisma.$transaction(async (tx) => {
        // Get user's market position to calculate voting weight
        let userPosition = await tx.userMarketPosition.findUnique({
          where: { 
            marketId_walletAddress: {
              marketId,
              walletAddress
            }
          }
        });
        
        // If no position exists, create one with zero shares
        if (!userPosition) {
          userPosition = await tx.userMarketPosition.create({
            data: {
              marketId,
              walletAddress,
              yesShares: 0,
              noShares: 0
            }
          });
        }
        
        // Calculate base voting weight based on user's net position in the relevant outcome
        let baseVotingWeight = 1; // Base weight
        
        if (evidenceType === 'yes') {
          // For Yes evidence, weight is based on net Yes position (only if Yes > No)
          if (userPosition.yesShares > userPosition.noShares) {
            baseVotingWeight = Math.max(1, userPosition.yesShares - userPosition.noShares);
          }
        } else if (evidenceType === 'no') {
          // For No evidence, weight is based on net No position (only if No > Yes)
          if (userPosition.noShares > userPosition.yesShares) {
            baseVotingWeight = Math.max(1, userPosition.noShares - userPosition.yesShares);
          }
        }
        
        console.log('Backend voting weight calculation:', {
          evidenceType,
          userPosition: {
            yesShares: userPosition.yesShares,
            noShares: userPosition.noShares
          },
          baseVotingWeight,
          walletAddress,
          evidenceId
        });
        
        // Check if user has already voted on this specific evidence
        const existingVote = await tx.vote.findUnique({
          where: {
            evidenceId_walletAddress: {
              evidenceId,
              walletAddress
            }
          }
        });
        
        if (existingVote) {
          // User is toggling their vote off (remove upvote)
          await tx.vote.delete({
            where: { id: existingVote.id }
          });
        } else {
          // User is voting for the first time (add upvote)
          await tx.vote.create({
            data: {
              evidenceId,
              marketId,
              walletAddress,
              voteWeight: baseVotingWeight
            }
          });
        }
          // Calculate new net votes for this evidence
          const votes = await tx.vote.findMany({
            where: { evidenceId },
            select: { voteWeight: true }
          });
          
          const netVotes = votes.reduce((sum, vote) => sum + vote.voteWeight, 0);
          
          // Update the evidence with new net votes
          await tx.evidence.update({
            where: { id: evidenceId },
            data: { netVotes }
          });
          
        return { netVotes, action: 'toggled' };
      });
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Vote error:', error);
      res.status(500).json({ error: 'Failed to process vote', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 