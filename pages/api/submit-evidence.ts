import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers based on environment
  const origin = req.headers.origin;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const allowedOrigins = isDevelopment 
    ? ['http://localhost:3000', 'https://localhost:3000', 'http://localhost:3001']
    : ['https://www.thecitizen.io', 'https://mvpshell.vercel.app'];
  
  console.log('CORS Debug:', { origin, isDevelopment, allowedOrigins });
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    console.log('❌ CORS: Origin not allowed:', origin);
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
    console.log('=== EVIDENCE API DEBUG ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('Origin header:', req.headers.origin);
    console.log('Referer header:', req.headers.referer);
    console.log('Request body:', req.body);
    console.log('Body type:', typeof req.body);
    console.log('Body keys:', Object.keys(req.body || {}));
    
    const {
      marketId,
      type,
      title,
      url,
      description,
      walletAddress
    } = req.body;
    
    console.log('Extracted values:', {
      marketId: marketId + ' (type: ' + typeof marketId + ')',
      type: type + ' (type: ' + typeof type + ')',
      title: title + ' (type: ' + typeof title + ')',
      url: url + ' (type: ' + typeof url + ')',
      description: description + ' (type: ' + typeof description + ')',
      walletAddress: walletAddress + ' (type: ' + typeof walletAddress + ')'
    });

    // Validate required fields
    if (!marketId || typeof marketId !== 'string') {
      console.log('❌ Validation failed: marketId');
      return res.status(400).json({ error: 'Missing or invalid marketId', details: { marketId, type: typeof marketId } });
    }

    if (!type || !['yes', 'no'].includes(type)) {
      console.log('❌ Validation failed: type');
      return res.status(400).json({ error: 'Missing or invalid type (must be yes or no)', details: { type, typeOf: typeof type } });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      console.log('❌ Validation failed: title');
      return res.status(400).json({ error: 'Missing or invalid title', details: { title, type: typeof title, length: title?.length } });
    }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      console.log('❌ Validation failed: url');
      return res.status(400).json({ error: 'Missing or invalid url', details: { url, type: typeof url, length: url?.length } });
    }

    if (description !== undefined && description !== '' && (typeof description !== 'string' || description.trim().length === 0)) {
      console.log('❌ Validation failed: description');
      return res.status(400).json({ error: 'Description must be a non-empty string if provided', details: { description, type: typeof description } });
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      console.log('❌ Validation failed: walletAddress');
      return res.status(400).json({ error: 'Missing or invalid walletAddress', details: { walletAddress, type: typeof walletAddress } });
    }

    console.log('✅ All validations passed!');
    console.log('Creating evidence with data:', {
      marketId,
      type,
      title: title.trim(),
      url: url.trim(),
      description: description ? description.trim() : '',
      walletAddress
    });

    // Create the evidence record
    const evidence = await prisma.evidence.create({
      data: {
        marketId: marketId.trim(),
        type: type as 'yes' | 'no',
        title: title.trim(),
        url: url.trim(),
        description: description ? description.trim() : '',
        walletAddress: walletAddress.trim(),
      },
    });

    console.log('Evidence created successfully:', evidence);

    // Return success response
    res.status(201).json({
      success: true,
      data: evidence
    });

  } catch (error) {
    console.error('Error in submit-evidence API:', error);
    console.error('Request body:', req.body);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    res.status(500).json({ 
      error: 'Failed to create evidence',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
