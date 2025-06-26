import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { walletAddress, yesShares, noShares } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }

      // Upsert user position (create if doesn't exist, update if it does)
      const userPosition = await prisma.userMarketPosition.upsert({
        where: { walletAddress },
        update: {
          yesShares: yesShares || 0,
          noShares: noShares || 0,
          lastUpdated: new Date()
        },
        create: {
          walletAddress,
          yesShares: yesShares || 0,
          noShares: noShares || 0
        }
      });
      
      // Recalculate all existing votes for this user with new position
      await recalculateUserVotes(walletAddress, yesShares || 0, noShares || 0);
      
      res.status(200).json(userPosition);
    } catch (error) {
      console.error('Error updating user position:', error);
      res.status(500).json({ error: 'Failed to update user position' });
    }
  } else {
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Helper function to recalculate all votes for a user
async function recalculateUserVotes(walletAddress: string, yesShares: number, noShares: number) {
  // Get all votes by this user
  const userVotes = await prisma.vote.findMany({
    where: { walletAddress },
    include: {
      evidence: true // Include evidence to get the type
    }
  });
  
  // Calculate new voting weights for each evidence type
  let yesVotingWeight = 1;
  let noVotingWeight = 1;
  
  if (yesShares > noShares) {
    yesVotingWeight = Math.max(1, yesShares - noShares);
  }
  if (noShares > yesShares) {
    noVotingWeight = Math.max(1, noShares - yesShares);
  }
  
  // Update each vote with new weight
  for (const vote of userVotes) {
    let newVoteWeight = 1;
    
    if (vote.evidence.type === 'yes') {
      newVoteWeight = yesVotingWeight;
    } else if (vote.evidence.type === 'no') {
      newVoteWeight = noVotingWeight;
    }
    
    // Update the vote weight
    await prisma.vote.update({
      where: { id: vote.id },
      data: { voteWeight: newVoteWeight }
    });
    
    // Recalculate net votes for this evidence
    await recalculateEvidenceVotes(vote.evidenceId);
  }
}

// Helper function to recalculate net votes for evidence
async function recalculateEvidenceVotes(evidenceId: number) {
  const votes = await prisma.vote.findMany({
    where: { evidenceId }
  });
  
  const netVotes = votes.reduce((sum, vote) => sum + vote.voteWeight, 0);
  
  // Update the evidence with new net votes
  await prisma.evidence.update({
    where: { id: evidenceId },
    data: { netVotes }
  });
} 