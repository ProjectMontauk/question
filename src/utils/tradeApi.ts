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
  // Use server-side API route for secure trade submission
  const res = await fetch('/api/submit-trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tradeData),
  });
  if (!res.ok) throw new Error('Failed to submit trade');
  
  // Check if response has content before parsing JSON
  const text = await res.text();
  if (!text) {
    return null; // Return null for empty responses
  }
  
  try {
    const result = JSON.parse(text);
    // Return the data field from server-side response
    return result.success ? result.data : result;
  } catch (error) {
    console.error('Failed to parse trade response:', error);
    return null;
  }
}

export async function fetchTrades(walletAddress: string) {
  const res = await fetch(`/api/trade?walletAddress=${walletAddress}`);
  if (!res.ok) throw new Error('Failed to fetch trades');
  
  // Check if response has content before parsing JSON
  const text = await res.text();
  if (!text) {
    return []; // Return empty array for empty responses
  }
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse trades response:', error);
    return [];
  }
} 