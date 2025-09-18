import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from './jwt';

// This is like the "wristband checker" at each area of the club
export function withAuth(handler: Function) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Set CORS headers
    const origin = req.headers.origin;
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowedOrigins = isDevelopment 
      ? ['https://www.thecitizen.io', 'http://localhost:3000']
      : ['https://www.thecitizen.io'];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Get the wristband (JWT token) from the cookie
    const token = req.cookies.authToken;
    if (!token) {
      return res.status(401).json({ 
        error: 'No wristband found - please authenticate first' 
      });
    }
    
    // Verify the wristband is real and not expired
    const payload = verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({ 
        error: 'Invalid or expired wristband - please get a new one' 
      });
    }
    
    // Add user info to the request (like adding their name to the guest list)
    (req as any).user = payload;
    
    // Let them through to the protected area
    return handler(req, res);
  };
}

// Rate limiting (like limiting how many drinks someone can order)
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

export function validateRateLimit(req: NextApiRequest): boolean {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const key = ip as string;
  
  if (!key) return false;
  
  const now = Date.now();
  let entry = rateLimitStore.get(key);
  
  if (!entry || now - entry.lastReset > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, lastReset: now };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}
