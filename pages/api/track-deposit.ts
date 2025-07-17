import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, amount, transactionHash } = req.body;

    if (!walletAddress || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Record the deposit
    const deposit = await prisma.userDeposits.create({
      data: {
        walletAddress,
        amount: parseFloat(amount),
        transactionHash: transactionHash || null,
      },
    });

    res.status(200).json({ success: true, deposit });
  } catch (error) {
    console.error('Error tracking deposit:', error);
    res.status(500).json({ error: 'Failed to track deposit' });
  }
} 