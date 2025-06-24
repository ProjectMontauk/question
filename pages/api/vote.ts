import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { evidenceId, walletAddress, voteType, evidenceType } = req.body;
    
    if (!evidenceId || !walletAddress || !voteType || !evidenceType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (voteType !== 'upvote') {
      return res.status(400).json({ error: 'Only upvotes are allowed' });
    }
    
    if (!['yes', 'no'].includes(evidenceType)) {
      return res.status(400).json({ error: 'Invalid evidence type' });
    }
    
    try {
      // Get user's market position to calculate voting weight
      let userPosition = await prisma.userMarketPosition.findUnique({
        where: { walletAddress }
      });
      
      // If no position exists, create one with zero shares
      if (!userPosition) {
        userPosition = await prisma.userMarketPosition.create({
          data: {
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
        } else {
          baseVotingWeight = 1; // Base weight if No shares >= Yes shares
        }
      } else if (evidenceType === 'no') {
        // For No evidence, weight is based on net No position (only if No > Yes)
        if (userPosition.noShares > userPosition.yesShares) {
          baseVotingWeight = Math.max(1, userPosition.noShares - userPosition.yesShares);
        } else {
          baseVotingWeight = 1; // Base weight if Yes shares >= No shares
        }
      }
      
      // Get or create user's voting activity for this evidence type
      let userVotingActivity = await prisma.userVotingActivity.findUnique({
        where: {
          walletAddress_evidenceType: {
            walletAddress,
            evidenceType
          }
        }
      });
      
      if (!userVotingActivity) {
        userVotingActivity = await prisma.userVotingActivity.create({
          data: {
            walletAddress,
            evidenceType,
            totalVotes: 0
          }
        });
      }
      
      // Check if user has already voted on this specific evidence
      const existingVote = await prisma.vote.findUnique({
        where: {
          evidenceId_walletAddress: {
            evidenceId,
            walletAddress
          }
        }
      });
      
      let totalVotesForType = userVotingActivity.totalVotes;
      
      if (existingVote) {
        // User is updating their vote on this evidence
        // No change to total votes count
      } else {
        // User is voting on a new evidence piece
        totalVotesForType += 1;
        
        // Update the voting activity count
        await prisma.userVotingActivity.update({
          where: { id: userVotingActivity.id },
          data: { totalVotes: totalVotesForType }
        });
      }
      
      // Calculate divided voting weight - ensure it's at least 1 and handle division by zero
      const dividedVotingWeight = totalVotesForType > 0 
        ? Math.max(1, Math.floor(baseVotingWeight / totalVotesForType))
        : baseVotingWeight; // If no votes yet, use full base weight
      
      // Ensure voteWeight is a valid positive integer
      const finalVoteWeight = Math.max(1, Math.floor(dividedVotingWeight));
      
      console.log('Vote calculation:', {
        evidenceId,
        walletAddress,
        voteType,
        evidenceType,
        baseVotingWeight,
        totalVotesForType,
        dividedVotingWeight,
        finalVoteWeight
      });
      
      if (existingVote) {
        // Update existing vote with new divided weight
        const updatedVote = await prisma.vote.update({
          where: { id: existingVote.id },
          data: {
            voteWeight: finalVoteWeight
          }
        });
        
        // Recalculate net votes for this evidence
        await recalculateEvidenceVotes(evidenceId);
        
        res.status(200).json(updatedVote);
      } else {
        // Create new vote with divided weight
        const newVote = await prisma.vote.create({
          data: {
            evidenceId,
            walletAddress,
            voteWeight: finalVoteWeight
          }
        });
        
        // Recalculate net votes for this evidence
        await recalculateEvidenceVotes(evidenceId);
        
        res.status(201).json(newVote);
      }
    } catch (error) {
      console.error('Vote error:', error);
      res.status(500).json({ error: 'Failed to process vote', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Helper function to recalculate net votes for evidence
async function recalculateEvidenceVotes(evidenceId: number) {
  const votes = await prisma.vote.findMany({
    where: { evidenceId }
  });
  
  // Since only upvotes are allowed, netVotes is just the sum of all vote weights
  const netVotes = votes.reduce((sum, vote) => sum + vote.voteWeight, 0);
  
  // Update the evidence with new net votes
  await prisma.evidence.update({
    where: { id: evidenceId },
    data: { netVotes }
  });
} 