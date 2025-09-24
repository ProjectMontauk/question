import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    const { marketId, yesProbability, noProbability, timestamp } = req.body;

    // Validate required fields
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid marketId' });
    }

    if (yesProbability === undefined || noProbability === undefined) {
      return res.status(400).json({ error: 'Missing probability values' });
    }

    // Get the API base URL
    const API_BASE_URL = process.env.NODE_ENV === 'production' 
      ? 'https://mvpshell.vercel.app' 
      : '';

    // Call the protected odds-history endpoint with server-side secret key
    const oddsResponse = await fetch(`${API_BASE_URL}/api/odds-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.API_SECRET_KEY || 'your-api-key-here'
      },
      body: JSON.stringify({
        marketId,
        yesProbability: Number(yesProbability),
        noProbability: Number(noProbability),
        timestamp: timestamp || new Date().toISOString()
      })
    });

    if (!oddsResponse.ok) {
      const errorText = await oddsResponse.text();
      console.error('Failed to record odds:', oddsResponse.status, errorText);
      return res.status(oddsResponse.status).json({ 
        error: 'Failed to record odds to database',
        details: errorText
      });
    }

    const result = await oddsResponse.json();
    console.log('Successfully recorded odds:', result);
    
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error in record-odds API:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
