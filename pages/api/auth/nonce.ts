import type { NextApiRequest, NextApiResponse } from 'next';
import { generateNonce, storeNonce } from '../../../src/lib/jwt';

// This is like the "door" - gives you a challenge to solve
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  const origin = req.headers.origin;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const allowedOrigins = isDevelopment 
    ? ['https://www.thecitizen.io', 'http://localhost:3000']
    : ['https://www.thecitizen.io'];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = req.query;
    
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    // Generate a challenge (like a puzzle to solve)
    const nonce = generateNonce();
    
    // Store the challenge temporarily
    storeNonce(walletAddress, nonce);

    console.log(`Generated challenge for ${walletAddress}: ${nonce}`);

    return res.status(200).json({ nonce });
  } catch (error) {
    console.error('Nonce generation error:', error);
    return res.status(500).json({ error: 'Failed to generate challenge' });
  }
}
