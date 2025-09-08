import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers based on environment
  const origin = req.headers.origin;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const allowedOrigins = isDevelopment 
    ? ['http://localhost:3000', 'https://localhost:3000']
    : ['https://www.thecitizen.io'];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
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
    console.log('Submit Test Deposit API called with method:', req.method);
    console.log('Submit Test Deposit API request headers:', req.headers);
    console.log('Submit Test Deposit API request body:', req.body);
    
    const { walletAddress } = req.body;

    if (!walletAddress) {
      console.error('Missing wallet address');
      return res.status(400).json({ error: 'Missing wallet address' });
    }

    // Check if a deposit already exists for this wallet
    const existingDeposit = await prisma.userDeposits.findFirst({
      where: {
        walletAddress: walletAddress,
      },
    });

    if (existingDeposit) {
      console.log('Deposit already exists for wallet:', walletAddress);
      return res.status(400).json({ 
        error: 'Deposit already exists for this wallet',
        existingDeposit 
      });
    }

    // Create test deposit
    const deposit = await prisma.userDeposits.create({
      data: {
        walletAddress: walletAddress,
        amount: 100000, // 𐆖100,000 deposit
        transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000", // Fake transaction hash
      },
    });

    console.log('Test deposit created successfully:', deposit);

    res.status(200).json({ 
      success: true, 
      message: 'Test deposit of 𐆖100,000 added successfully',
      data: deposit
    });
  } catch (error) {
    console.error('Error in submit-test-deposit API:', error);
    console.error('Request body:', req.body);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    res.status(500).json({ 
      error: 'Failed to add test deposit',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
