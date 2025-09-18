import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../src/lib/jwt';

// This checks if the user has a valid "wristband" (cookie)
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
    // Get the token from the cookie
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.status(401).json({ 
        authenticated: false,
        error: 'No wristband found' 
      });
    }

    // Verify the token
    const payload = verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({ 
        authenticated: false,
        error: 'Invalid or expired wristband' 
      });
    }

    // User is authenticated
    return res.status(200).json({
      authenticated: true,
      token, // Send token back for client state management
      walletAddress: payload.walletAddress
    });

  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ 
      authenticated: false,
      error: 'Authentication check failed' 
    });
  }
}
