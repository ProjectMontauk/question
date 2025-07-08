export async function submitTrade(tradeData: {
  walletAddress: string;
  marketTitle: string;
  marketId: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  betAmount: number;
  toWin: number;
  status?: string;
}) {
  try {
    console.log('Submitting trade to API:', tradeData);
    
    const res = await fetch('/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData),
    });
    
    console.log('Trade API response status:', res.status, res.statusText);
    console.log('Trade API response headers:', Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      console.error('Trade API error:', res.status, res.statusText);
      throw new Error(`Failed to submit trade: ${res.status} ${res.statusText}`);
    }
    
    // Check if response has content before parsing JSON
    const text = await res.text();
    console.log('Trade API response text:', text);
    
    if (!text) {
      console.log('Trade API returned empty response');
      return null; // Return null for empty responses
    }
    
    try {
      const parsed = JSON.parse(text);
      console.log('Trade API parsed response:', parsed);
      return parsed;
    } catch (error) {
      console.error('Failed to parse trade response:', error, 'Raw text:', text);
      return null;
    }
  } catch (error) {
    console.error('Trade API request failed:', error);
    throw error;
  }
}

export async function fetchTrades(walletAddress: string) {
  try {
    console.log('Fetching trades for wallet:', walletAddress);
    
    const res = await fetch(`/api/trade?walletAddress=${walletAddress}`);
    
    console.log('Trades API response status:', res.status, res.statusText);
    
    if (!res.ok) {
      console.error('Trades API error:', res.status, res.statusText);
      throw new Error(`Failed to fetch trades: ${res.status} ${res.statusText}`);
    }
    
    // Check if response has content before parsing JSON
    const text = await res.text();
    console.log('Trades API response text:', text);
    
    if (!text) {
      console.log('Trades API returned empty response');
      return []; // Return empty array for empty responses
    }
    
    try {
      const parsed = JSON.parse(text);
      console.log('Trades API parsed response:', parsed);
      return parsed;
    } catch (error) {
      console.error('Failed to parse trades response:', error, 'Raw text:', text);
      return [];
    }
  } catch (error) {
    console.error('Trades API request failed:', error);
    return [];
  }
}

export async function recordNewOdds(marketId: string, outcome: string, newOdds: number) {
  try {
    console.log('Recording new odds:', { marketId, outcome, newOdds });
    
    const res = await fetch('/api/odds-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketId, outcome, newOdds }),
    });
    
    console.log('Odds API response status:', res.status, res.statusText);
    console.log('Odds API response headers:', Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      console.error('Odds API error:', res.status, res.statusText);
      throw new Error(`Failed to record odds: ${res.status} ${res.statusText}`);
    }
    
    // Check if response has content before parsing JSON
    const text = await res.text();
    console.log('Odds API response text:', text);
    
    if (!text) {
      console.log('Odds API returned empty response');
      return null; // Return null for empty responses
    }
    
    try {
      const parsed = JSON.parse(text);
      console.log('Odds API parsed response:', parsed);
      return parsed;
    } catch (error) {
      console.error('Failed to parse odds response:', error, 'Raw text:', text);
      return null;
    }
  } catch (error) {
    console.error('Odds API request failed:', error);
    throw error;
  }
}

// Warm-up function to initialize API endpoints
export async function warmUpApis() {
  try {
    console.log('Warming up APIs...');
    
    // Test health endpoint
    const healthRes = await fetch('/api/health');
    console.log('Health check response:', healthRes.status, healthRes.statusText);
    
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      console.log('Health check data:', healthData);
    }
    
    // Test trade endpoint with a dummy request
    const tradeRes = await fetch('/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: '0x0000000000000000000000000000000000000000',
        marketTitle: 'Test Market',
        marketId: 'test',
        outcome: 'Test',
        shares: 0,
        avgPrice: 0,
        betAmount: 0,
        toWin: 0,
        status: 'TEST'
      }),
    });
    console.log('Trade API warm-up response:', tradeRes.status, tradeRes.statusText);
    
    console.log('API warm-up completed');
  } catch (error) {
    console.error('API warm-up failed:', error);
  }
}

// Utility function to handle gas estimation errors
export function handleGasEstimationError(error: any): string {
  console.error('Gas estimation error:', error);
  
  if (error?.message) {
    const msg = error.message.toLowerCase();
    
    // Check for JSON parsing errors
    if (msg.includes('unexpected end of json input') || msg.includes('failed to fetch gas')) {
      return 'Network error during gas estimation. Please check your connection and try again.';
    }
    
    // Check for other gas-related errors
    if (msg.includes('gas')) {
      return 'Gas estimation failed. Try a smaller amount or check your network connection.';
    }
    
    // Check for network errors
    if (msg.includes('network') || msg.includes('connection')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }
    
    // Check for RPC errors
    if (msg.includes('rpc') || msg.includes('provider')) {
      return 'Blockchain network issue. Please try again in a few moments.';
    }
  }
  
  return 'Transaction preparation failed. Please try again.';
} 