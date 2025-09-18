import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';
import { withAuth } from '../../src/lib/api-auth';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Now this API requires a "wristband" (JWT token) to access

  if (req.method === 'GET') {
    try {
      console.log('Health check API called');
      
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      console.log('Database connection successful');
      
      return res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      return res.status(500).json({ 
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  res.setHeader('Allow', ['GET']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

// Wrap with authentication - now requires "wristband"
export default withAuth(handler);

