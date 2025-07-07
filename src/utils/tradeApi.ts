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
  const res = await fetch('/api/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tradeData),
  });
  if (!res.ok) throw new Error('Failed to submit trade');
  return res.json();
}

export async function fetchTrades(walletAddress: string) {
  const res = await fetch(`/api/trade?walletAddress=${walletAddress}`);
  if (!res.ok) throw new Error('Failed to fetch trades');
  return res.json();
} 