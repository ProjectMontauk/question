import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';

// The "bouncer's secret key" - only the server knows this
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// What's written on the "wristband" (JWT token)
interface JwtPayload {
  walletAddress: string;
  nonce: string;
  iat: number; // issued at
  exp: number; // expires at
}

// Generate a "wristband" (JWT token) after ID verification
export function generateToken(walletAddress: string, nonce: string): string {
  return jwt.sign(
    { walletAddress, nonce },
    JWT_SECRET,
    { expiresIn: '24h' } // wristband expires in 24 hours
  );
}

// Set JWT token as HTTP-only cookie
export function setAuthCookie(res: any, token: string) {
  const maxAge = 24 * 60 * 60; // 24 hours in seconds
  
  res.setHeader('Set-Cookie', [
    `authToken=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`
  ]);
}

// Clear the auth cookie
export function clearAuthCookie(res: any) {
  res.setHeader('Set-Cookie', [
    'authToken=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
  ]);
}

// Verify the "wristband" (JWT token) is real
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    console.error('Invalid wristband:', error);
    return null;
  }
}

// Verify the "ID" (wallet signature) is real
export async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    console.log('Signature verification details:', {
      walletAddress,
      message,
      signature: signature.substring(0, 10) + '...',
      messageLength: message.length
    });
    
    // This is like checking if the signature matches the ID
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    console.log('Recovered address:', recoveredAddress);
    console.log('Address match:', recoveredAddress.toLowerCase() === walletAddress.toLowerCase());
    
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.error('Invalid ID signature:', error);
    return false;
  }
}

// Generate a "challenge" (nonce) for the user to sign with timestamp
export function generateNonce(): string {
  const randomPart = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
  const timestamp = Math.floor(Date.now() / 1000).toString(16); // Unix timestamp in hex
  return `${randomPart}${timestamp}`;
}

// Store "challenges" temporarily (like a clipboard at the door)
const nonceStore = new Map<string, { nonce: string; timestamp: number }>();
const NONCE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

// Store a challenge for a user
export function storeNonce(walletAddress: string, nonce: string): void {
  const key = walletAddress.toLowerCase();
  const value = { nonce, timestamp: Date.now() };
  nonceStore.set(key, value);
  console.log(`Stored nonce for ${key}:`, value);
  console.log(`Current nonce store size:`, nonceStore.size);
  
  // Set a timer to clean up the nonce after 60 seconds
  setTimeout(() => {
    const stored = nonceStore.get(key);
    if (stored && stored.nonce === nonce) {
      nonceStore.delete(key);
      console.log(`Nonce auto-expired for ${key} after 60 seconds`);
    }
  }, 60000); // 60 seconds
}

// Check if the challenge is valid and not expired
export function validateNonce(walletAddress: string, nonce: string): boolean {
  const key = walletAddress.toLowerCase();
  const stored = nonceStore.get(key);
  console.log(`Looking for nonce for ${key}, found:`, stored);
  console.log(`Current nonce store contents:`, Array.from(nonceStore.entries()));
  console.log(`Current nonce store size:`, nonceStore.size);
  
  if (!stored) {
    console.log('No challenge found for this user');
    return false;
  }
  
  // Check if challenge expired (like a ticket that's too old)
  const timeDiff = Date.now() - stored.timestamp;
  console.log(`Time since nonce generated: ${timeDiff}ms, expiration: ${NONCE_EXPIRATION_MS}ms`);
  
  if (timeDiff > NONCE_EXPIRATION_MS) {
    nonceStore.delete(walletAddress.toLowerCase());
    console.log('Challenge expired');
    return false;
  }
  
  // Check if challenge matches
  console.log(`Comparing stored nonce: "${stored.nonce}" with received: "${nonce}"`);
  if (stored.nonce === nonce) {
    console.log('Challenge validated successfully');
    return true;
  }
  
  console.log('Challenge does not match');
  return false;
}

// Consume a nonce after successful authentication
export function consumeNonce(walletAddress: string): void {
  nonceStore.delete(walletAddress.toLowerCase());
  console.log(`Nonce consumed for ${walletAddress}`);
}