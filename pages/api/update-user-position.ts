import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { walletAddress, yesShares, noShares } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing wallet address' });
    }
    
    try {
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
      console.error('Update user position error:', error);
      res.status(500).json({ error: 'Failed to update user position' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Helper function to recalculate all votes for a user
async function recalculateUserVotes(walletAddress: string, yesShares: number, noShares: number) {
  // Get all votes by this user
  const userVotes = await prisma.vote.findMany({
    where: { walletAddress }
  });
  
  // Get user's voting activity for both evidence types
  const yesActivity = await prisma.userVotingActivity.findUnique({
    where: {
      walletAddress_evidenceType: {
        walletAddress,
        evidenceType: 'yes'
      }
    }
  });
  
  const noActivity = await prisma.userVotingActivity.findUnique({
    where: {
      walletAddress_evidenceType: {
        walletAddress,
        evidenceType: 'no'
      }
    }
  });
  
  // Calculate base voting weights
  let yesBaseWeight = 1;
  let noBaseWeight = 1;
  
  if (yesShares > noShares) {
    yesBaseWeight = Math.max(1, yesShares - noShares);
  }
  if (noShares > yesShares) {
    noBaseWeight = Math.max(1, noShares - yesShares);
  }
  
  // Update each vote with new divided weight
  for (const vote of userVotes) {
    // Get the evidence to determine its type
    const evidence = await prisma.evidence.findUnique({
      where: { id: vote.evidenceId }
    });
    
    if (evidence) {
      let dividedWeight = 1;
      
      if (evidence.type === 'yes' && yesActivity) {
        dividedWeight = Math.floor(yesBaseWeight / yesActivity.totalVotes);
      } else if (evidence.type === 'no' && noActivity) {
        dividedWeight = Math.floor(noBaseWeight / noActivity.totalVotes);
      }
      
      // Update the vote weight
      await prisma.vote.update({
        where: { id: vote.id },
        data: { voteWeight: dividedWeight }
      });
      
      // Recalculate net votes for this evidence
      await recalculateEvidenceVotes(vote.evidenceId);
    }
  }
}

// Helper function to recalculate net votes for evidence
async function recalculateEvidenceVotes(evidenceId: number) {
  const votes = await prisma.vote.findMany({
    where: { evidenceId }
  });
  
  let netVotes = 0;
  for (const vote of votes) {
    if (vote.voteType === 'upvote') {
      netVotes += vote.voteWeight;
    } else if (vote.voteType === 'downvote') {
      netVotes -= vote.voteWeight;
    }
  }
  
  // Update the evidence with new net votes
  await prisma.evidence.update({
    where: { id: evidenceId },
    data: { netVotes }
  });
} 