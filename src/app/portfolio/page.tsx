"use client";

import Navbar from "../../../components/Navbar";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { fetchTrades } from "../../utils/tradeApi";
import { marketContract, tokenContract } from "../../../constants/contracts";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { usePortfolio } from "../../contexts/PortfolioContext";
import React from "react";

// Define Trade interface
interface Trade {
  id: number;
  walletAddress: string;
  marketTitle: string;
  marketId: number;
  outcome: string;
  shares: number;
  avgPrice: number;
  betAmount: number;
  toWin: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function formatBalance(balance: bigint | undefined): number {
  if (!balance) return 0;
  // Divide by 10^18 and show as a number
  return Number(balance) / 1e18;
}

export default function PortfolioPage() {
  const account = useActiveAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pnlHistory, setPnlHistory] = useState<any[]>([]);
  const [loadingPnl, setLoadingPnl] = useState(false);
  const { setPortfolioValue } = usePortfolio();

  // Fetch current odds for Yes (0) and No (1) positions
  const { data: oddsYes } = useReadContract({
    contract: marketContract,
    method: "function odds(uint256 _outcome) view returns (int128)",
    params: [0n],
  });
  
  const { data: oddsNo } = useReadContract({
    contract: marketContract,
    method: "function odds(uint256 _outcome) view returns (int128)",
    params: [1n],
  });

  // Fetch user's cash balance from contract (same as Navbar)
  const { data: balance } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });

  const cash = formatBalance(balance);

  // Fetch trades when account changes
  useEffect(() => {
    const loadTrades = async () => {
      if (!account?.address) {
        setTrades([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const tradeData = await fetchTrades(account.address);
        setTrades(tradeData);
      } catch (err) {
        console.error('Failed to fetch trades:', err);
        setError('Failed to load portfolio data');
      } finally {
        setLoading(false);
      }
    };

    loadTrades();
  }, [account?.address]);

  // Add PnL history update on page visit
  useEffect(() => {
    const updatePnLHistory = async () => {
      if (!account?.address) return;
      try {
        await fetch('/api/pnl-history-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: account.address }),
        });
      } catch (e) {
        // Optionally log or ignore
        // console.error('Failed to update PnL history:', e);
      }
    };
    updatePnLHistory();
  }, [account?.address]);

  // Fetch PnL history for chart
  useEffect(() => {
    const fetchPnlHistory = async () => {
      if (!account?.address) {
        setPnlHistory([]);
        return;
      }
      setLoadingPnl(true);
      try {
        const res = await fetch(`/api/pnl-history?walletAddress=${account.address}`);
        const data = await res.json();
        // Convert timestamp to ms since epoch for recharts
        const formatted = Array.isArray(data)
          ? data.reverse().map(entry => ({ ...entry, timestamp: new Date(entry.timestamp).getTime() }))
          : [];
        setPnlHistory(formatted);
      } catch (e) {
        setPnlHistory([]);
      } finally {
        setLoadingPnl(false);
      }
    };
    fetchPnlHistory();
  }, [account?.address]);

  // Before rendering, print the data being plotted
  console.log('PnL History data for chart:', pnlHistory);

  // Helper function to get outcome color
  const getOutcomeColor = (outcome: string) => {
    if (outcome.toLowerCase().includes('yes')) return 'text-green-600';
    if (outcome.toLowerCase().includes('no')) return 'text-red-600';
    return 'text-blue-600';
  };

  // Helper function to format price in cents
  const formatPrice = (price: number) => {
    return Math.round(price * 100); // Convert to cents
  };

  // Helper function to get current price for a position as a number (for calculations)
  const getCurrentPriceNumber = (outcome: string) => {
    if (outcome.toLowerCase().includes('yes') && oddsYes !== undefined) {
      return Number(oddsYes) / Math.pow(2, 64);
    } else if (outcome.toLowerCase().includes('no') && oddsNo !== undefined) {
      return Number(oddsNo) / Math.pow(2, 64);
    }
    return 0;
  };

  // Helper function to get current price for a position
  const getCurrentPrice = (outcome: string) => {
    if (outcome.toLowerCase().includes('yes') && oddsYes !== undefined) {
      const price = Number(oddsYes) / Math.pow(2, 64);
      return formatPrice(price);
    } else if (outcome.toLowerCase().includes('no') && oddsNo !== undefined) {
      const price = Number(oddsNo) / Math.pow(2, 64);
      return formatPrice(price);
    }
    return '--';
  };

  // Calculate total portfolio value
  const totalPositionsValue = trades.reduce((sum, trade) => sum + trade.shares * getCurrentPriceNumber(trade.outcome), 0);
  const totalPortfolio = cash + totalPositionsValue;
  React.useEffect(() => {
    setPortfolioValue(totalPortfolio.toFixed(2));
  }, [totalPortfolio, setPortfolioValue]);

  // Calculate all-time P/L
  const allTimePL = trades.reduce((sum, trade) => sum + (trade.shares * getCurrentPriceNumber(trade.outcome) - trade.betAmount), 0);
  const totalBetAmount = trades.reduce((sum, trade) => sum + trade.betAmount, 0);
  const allTimePLPercent = totalBetAmount > 0 ? (allTimePL / totalBetAmount) * 100 : 0;

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center pt-8 w-full">
        <div className="max-w-7xl w-full mx-auto px-4">
          {/* Portfolio Balance Card */}
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 mb-8 flex items-start justify-start w-[470px] max-w-full" style={{ height: 176 }}>
            <div>
              <div className="flex items-center mb-2">
                <span className="uppercase tracking-widest text-gray-500 font-semibold text-sm">Portfolio</span>
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">${totalPortfolio.toFixed(2)}</div>
              <div className="text-gray-500 font-semibold text-sm uppercase tracking-widest mb-1">Profit/Loss</div>
              <div className={
                allTimePL > 0 ? "text-green-600 font-semibold text-lg" :
                allTimePL < 0 ? "text-red-600 font-semibold text-lg" :
                "text-gray-500 font-semibold text-lg"
              }>
                {allTimePL >= 0 ? "+" : "-"}${Math.abs(allTimePL).toFixed(2)}
                <span className="ml-1">
                  ({Math.abs(allTimePLPercent).toFixed(2)}%)
                </span>
                <span className="text-gray-400 font-normal text-base ml-1">All-Time</span>
              </div>
            </div>
            <div className="flex flex-col items-start ml-20">
              <span className="text-gray-500 font-semibold text-sm uppercase tracking-widest mb-1">Cash</span>
              <span className="text-gray-900 font-bold text-[14px] mb-4">${cash.toFixed(2)}</span>
              <span className="text-gray-500 font-semibold text-sm uppercase tracking-widest mb-1 block" style={{ paddingTop: 12 }}>Bet Value</span>
              <span className="text-gray-900 font-bold text-[14px] mb-4">${totalPositionsValue.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-200 p-0 overflow-x-auto">
            {loading ? (
              <div className="text-center text-gray-500 py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                Loading portfolio...
              </div>
            ) : error ? (
              <div className="text-center text-red-500 py-12">
                {error}
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider">MARKET</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-left" colSpan={2}>
                        AVG <span className="mx-1">→</span> NOW <span title="Average price paid vs. current price" className="ml-1">&#9432;</span>
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-center">BET</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-center">TO WIN</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-center">VALUE</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-600 text-center">P/L</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {trades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-gray-50 transition">
                        {/* Market cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className={`font-semibold ${getOutcomeColor(trade.outcome)}`}>
                              {trade.outcome} {formatPrice(trade.avgPrice)}¢ <span className="text-gray-500 font-normal ml-1">{trade.shares.toFixed(2)} shares</span>
                            </div>
                            <div className="text-gray-900 font-medium text-sm leading-tight">{trade.marketTitle}</div>
                          </div>
                        </td>
                        {/* Avg → Now */}
                        <td className="px-6 pr-3 py-4 text-left text-gray-900 text-base" colSpan={2}>
                          {formatPrice(trade.avgPrice)}¢ <span className="mx-1">→</span> {getCurrentPrice(trade.outcome)}¢
                        </td>
                        {/* Bet */}
                        <td className="px-6 py-4 text-center text-gray-900 text-base">
                          ${trade.betAmount.toFixed(2)}
                        </td>
                        {/* To Win */}
                        <td className="px-6 py-4 text-center text-gray-900 text-base">
                          ${trade.toWin.toFixed(2)}
                        </td>
                        {/* Value */}
                        <td className="px-6 py-4 text-center text-base font-bold" style={{color: (trade.shares * getCurrentPriceNumber(trade.outcome)) > trade.betAmount ? '#16a34a' : '#dc2626'}}>
                          ${ (trade.shares * getCurrentPriceNumber(trade.outcome)).toFixed(2) }
                        </td>
                        {/* P/L */}
                        <td className="px-6 py-4 text-center text-base font-bold" style={{
                          color: (trade.shares * getCurrentPriceNumber(trade.outcome) - trade.betAmount) > 0 ? '#16a34a' :
                                (trade.shares * getCurrentPriceNumber(trade.outcome) - trade.betAmount) < 0 ? '#dc2626' : '#6b7280'
                        }}>
                          {(() => {
                            const pl = trade.shares * getCurrentPriceNumber(trade.outcome) - trade.betAmount;
                            return `${pl > 0 ? '+$' : pl < 0 ? '-$' : '$'}${Math.abs(pl).toFixed(2)}`;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* If no positions, show a message */}
                {trades.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    No trades yet. Your portfolio will appear here after you make your first trade.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 