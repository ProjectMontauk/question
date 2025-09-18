import type { NextApiRequest, NextApiResponse } from 'next';
import { generateToken, verifyWalletSignature, validateNonce, setAuthCookie, consumeNonce } from '../../../src/lib/jwt';

// This is like the "bouncer" - checks your ID and gives you a wristband
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Login request received:', { 
      walletAddress: req.body?.walletAddress, 
      hasSignature: !!req.body?.signature, 
      hasMessage: !!req.body?.message 
    });
    
    const { walletAddress, signature, message } = req.body;

    // Check if all required info is provided
    if (!walletAddress || !signature || !message) {
      console.log('Missing required fields:', { walletAddress: !!walletAddress, signature: !!signature, message: !!message });
      return res.status(400).json({ error: 'Missing required information' });
    }

    // Extract the challenge from the message
    // Message format: "Authenticate to MVP Shell: [nonce]"
    const nonceMatch = message.match(/Authenticate to MVP Shell: (.+)$/);
    if (!nonceMatch || !nonceMatch[1]) {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    const receivedNonce = nonceMatch[1];

    // Validate nonce format and recency (no persistent storage needed)
    console.log(`Validating nonce: ${receivedNonce} for ${walletAddress}`);
    
    // Check if nonce has valid format (alphanumeric, reasonable length)
    if (!/^[a-zA-Z0-9]{20,40}$/.test(receivedNonce)) {
      console.log(`Invalid nonce format: ${receivedNonce}`);
      return res.status(401).json({ error: 'Invalid challenge format' });
    }
    
    // Extract timestamp from nonce (last 8 characters are hex timestamp)
    try {
      const timestampHex = receivedNonce.slice(-8);
      const nonceTimestamp = parseInt(timestampHex, 16) * 1000; // Convert to milliseconds
      const nonceAge = Date.now() - nonceTimestamp;
      
      console.log(`Nonce timestamp: ${new Date(nonceTimestamp).toISOString()}, age: ${nonceAge}ms`);
      
      if (nonceAge > 5 * 60 * 1000) { // 5 minutes
        console.log(`Nonce too old: ${nonceAge}ms`);
        return res.status(401).json({ error: 'Challenge expired - please try again' });
      }
      
      if (nonceAge < 0) { // Future timestamp
        console.log(`Nonce from future: ${nonceAge}ms`);
        return res.status(401).json({ error: 'Invalid challenge timestamp' });
      }
      
    } catch (error) {
      console.log(`Error parsing nonce timestamp: ${error}`);
      return res.status(401).json({ error: 'Invalid challenge format' });
    }
    
    console.log(`Nonce validation passed: ${receivedNonce}`);

    // Verify the signature (like checking if the ID is real)
    console.log('Verifying signature:', { walletAddress, message, signature });
    const isValidSignature = await verifyWalletSignature(walletAddress, message, signature);
    console.log('Signature validation result:', isValidSignature);
    
    if (!isValidSignature) {
      return res.status(401).json({ error: 'Invalid signature - ID verification failed' });
    }

    // Generate a wristband (JWT token)
    const token = generateToken(walletAddress, receivedNonce);

    // Set the token as an HTTP-only cookie (more secure than localStorage)
    setAuthCookie(res, token);

    // Consume the nonce only after successful authentication
    consumeNonce(walletAddress);

    console.log(`Authentication successful for ${walletAddress}`);

    return res.status(200).json({
      success: true,
      walletAddress: walletAddress.toLowerCase(),
      expiresIn: '24h'
      // Don't send token in response body - it's now in the cookie
    });

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
