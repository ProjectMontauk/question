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

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { walletAddress, marketId, yesShares, noShares } = req.body;
  if (!walletAddress || !marketId || yesShares === undefined || noShares === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
      }

  try {
    const position = await prisma.userMarketPosition.upsert({
      where: {
        marketId_walletAddress: {
          marketId: String(marketId),
          walletAddress: String(walletAddress),
        },
      },
        update: {
        yesShares: Number(yesShares),
        noShares: Number(noShares),
        },
        create: {
        marketId: String(marketId),
        walletAddress: String(walletAddress),
        yesShares: Number(yesShares),
        noShares: Number(noShares),
      },
    });

    // Recalculate all votes for this user in this market
  const userVotes = await prisma.vote.findMany({
      where: { walletAddress: String(walletAddress), marketId: String(marketId) },
      include: { evidence: true }
    });

  for (const vote of userVotes) {
    let newVoteWeight = 1;
    if (vote.evidence.type === 'yes') {
        if (Number(yesShares) > Number(noShares)) {
          newVoteWeight = Math.max(1, Number(yesShares) - Number(noShares));
        }
    } else if (vote.evidence.type === 'no') {
        if (Number(noShares) > Number(yesShares)) {
          newVoteWeight = Math.max(1, Number(noShares) - Number(yesShares));
        }
    }
      // Update the vote weight if it changed
      if (vote.voteWeight !== newVoteWeight) {
    await prisma.vote.update({
      where: { id: vote.id },
      data: { voteWeight: newVoteWeight }
    });
      }
      // Recalculate netVotes for this evidence
      const votes = await prisma.vote.findMany({ where: { evidenceId: vote.evidenceId } });
      const netVotes = votes.reduce((sum, v) => sum + v.voteWeight, 0);
  await prisma.evidence.update({
        where: { id: vote.evidenceId },
    data: { netVotes }
  });
    }

    res.status(200).json(position);
  } catch (error) {
    console.error('Failed to update user position:', error);
    res.status(500).json({ error: 'Failed to update user position' });
  }
} 