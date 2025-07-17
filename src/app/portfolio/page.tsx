"use client";

import Navbar from "../../../components/Navbar";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { fetchTrades } from "../../utils/tradeApi";
import { getContractsForMarket, tokenContract } from "../../../constants/contracts";
import { useState, useEffect, useCallback } from "react";
import { readContract } from "thirdweb";
import { usePortfolio } from "../../contexts/PortfolioContext";
import React from "react";
import { prepareContractCall } from "thirdweb";
import { parseAmountToWei } from "../../utils/parseAmountToWei";

// Define Trade interface
interface Trade {
  id: number;
  walletAddress: string;
  marketTitle: string;
  marketId: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  betAmount: number;
  toWin: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Interface for storing market odds
interface MarketOdds {
  [marketId: string]: {
    oddsYes: bigint | undefined;
    oddsNo: bigint | undefined;
  };
}

// Interface for current positions
interface CurrentPosition {
  marketId: string;
  marketTitle: string;
  outcome: string;
  shares: number;
  currentPrice: number;
  positionValue: number;
  avgPrice?: number; // We'll need to calculate this from trade history
  betAmount?: number; // We'll need to calculate this from trade history
  toWin?: number; // We'll need to calculate this from trade history
  pnl?: number; // We'll need to calculate this
}

function formatBalance(balance: bigint | undefined): number {
  if (!balance) return 0;
  // Divide by 10^18 and show as a number
  return Number(balance) / 1e18;
}

export default function PortfolioPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pnlHistory, setPnlHistory] = useState<{ timestamp: number; pnl: number }[]>([]);
  const { setPortfolioValue } = usePortfolio();
  const [marketOdds, setMarketOdds] = useState<MarketOdds>({});
  const [activeTab, setActiveTab] = useState<'history' | 'current'>('history');
  const [currentPositions, setCurrentPositions] = useState<CurrentPosition[]>([]);
  const [currentPositionsLoading, setCurrentPositionsLoading] = useState(false);
  const [totalDeposits, setTotalDeposits] = useState<number>(0);

  // Fetch current odds for each market that the user has positions in
  const fetchMarketOdds = async (marketIds: string[]) => {
    const newMarketOdds: MarketOdds = {};
    
    for (const marketId of marketIds) {
      try {
        const { marketContract } = getContractsForMarket(marketId);
        
        const oddsYes = await readContract({
          contract: marketContract,
          method: "function odds(uint256 _outcome) view returns (int128)",
          params: [0n],
        });
        
        const oddsNo = await readContract({
          contract: marketContract,
          method: "function odds(uint256 _outcome) view returns (int128)",
          params: [1n],
        });
        
        newMarketOdds[marketId] = {
          oddsYes,
          oddsNo,
        };
      } catch (error) {
        console.error(`Failed to fetch odds for market ${marketId}:`, error);
        newMarketOdds[marketId] = {
          oddsYes: undefined,
          oddsNo: undefined,
        };
      }
    }
    
    setMarketOdds(newMarketOdds);
  };

  // Fetch current positions across all markets
  const fetchCurrentPositions = useCallback(async () => {
    if (!account?.address) {
      setCurrentPositions([]);
      return;
    }

    setCurrentPositionsLoading(true);
    try {
      const positions: CurrentPosition[] = [];
      const { getAllMarkets } = await import('../../data/markets');
      const markets = getAllMarkets();

      for (const market of markets) {
        try {
          const { conditionalTokensContract, outcome1PositionId, outcome2PositionId } = getContractsForMarket(market.id);
          
          // Fetch Yes shares balance
          const yesBalance = await readContract({
            contract: conditionalTokensContract,
            method: "function balanceOf(address account, uint256 id) view returns (uint256)",
            params: [
              account.address as `0x${string}`,
              BigInt(outcome1PositionId)
            ],
          });

          // Fetch No shares balance
          const noBalance = await readContract({
            contract: conditionalTokensContract,
            method: "function balanceOf(address account, uint256 id) view returns (uint256)",
            params: [
              account.address as `0x${string}`,
              BigInt(outcome2PositionId)
            ],
          });

          // Convert to real numbers (divide by 10^18)
          const yesShares = Number(yesBalance) / 1e18;
          const noShares = Number(noBalance) / 1e18;

          // Get current odds for this market
          const { marketContract } = getContractsForMarket(market.id);
          const oddsYes = await readContract({
            contract: marketContract,
            method: "function odds(uint256 _outcome) view returns (int128)",
            params: [0n],
          });
          const oddsNo = await readContract({
            contract: marketContract,
            method: "function odds(uint256 _outcome) view returns (int128)",
            params: [1n],
          });

          const currentPriceYes = Number(oddsYes) / Math.pow(2, 64);
          const currentPriceNo = Number(oddsNo) / Math.pow(2, 64);

          // Add Yes position if user has shares
          if (yesShares > 0) {
            positions.push({
              marketId: market.id,
              marketTitle: market.title,
              outcome: market.outcomes[0], // Yes outcome
              shares: yesShares,
              currentPrice: currentPriceYes,
              positionValue: yesShares * currentPriceYes,
            });
          }

          // Add No position if user has shares
          if (noShares > 0) {
            positions.push({
              marketId: market.id,
              marketTitle: market.title,
              outcome: market.outcomes[1], // No outcome
              shares: noShares,
              currentPrice: currentPriceNo,
              positionValue: noShares * currentPriceNo,
            });
          }
        } catch (error) {
          console.error(`Failed to fetch positions for market ${market.id}:`, error);
        }
      }

      setCurrentPositions(positions);
    } catch (error) {
      console.error('Failed to fetch current positions:', error);
    } finally {
      setCurrentPositionsLoading(false);
    }
  }, [account?.address]);

  // Fetch user's cash balance from contract (same as Navbar)
  const { data: balance, refetch } = useReadContract({
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
        
        // Get unique market IDs from trades and fetch their odds
        const uniqueMarketIds = [...new Set(tradeData.map((trade: Trade) => trade.marketId))] as string[];
        await fetchMarketOdds(uniqueMarketIds);
      } catch (err) {
        console.error('Failed to fetch trades:', err);
        setError('Failed to load portfolio data');
      } finally {
        setLoading(false);
      }
    };

    loadTrades();
  }, [account?.address]);

  // Fetch total deposits for P/L calculation
  const fetchTotalDeposits = useCallback(async () => {
    if (!account?.address) {
      setTotalDeposits(0);
      return;
    }

    try {
      const response = await fetch(`/api/user-deposits?walletAddress=${account.address}`);
      if (response.ok) {
        const data = await response.json();
        setTotalDeposits(data.totalDeposits || 0);
      } else {
        console.error('Failed to fetch deposits');
        setTotalDeposits(0);
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
      setTotalDeposits(0);
    } finally {
    }
  }, [account?.address]);

  // Fetch current positions when account changes or when Current tab is selected
  useEffect(() => {
    if (activeTab === 'current') {
      fetchCurrentPositions();
    }
  }, [account?.address, activeTab, fetchCurrentPositions]);

  // Fetch total deposits when account changes
  useEffect(() => {
    fetchTotalDeposits();
  }, [account?.address, fetchTotalDeposits]);

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
        console.log(e);
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
      try {
        const res = await fetch(`/api/pnl-history?walletAddress=${account.address}`);
        const data = await res.json();
        // Convert timestamp to ms since epoch for recharts
        const formatted = Array.isArray(data)
          ? data.reverse().map(entry => ({ ...entry, timestamp: new Date(entry.timestamp).getTime() }))
          : [];
        setPnlHistory(formatted);
      } catch (e) {
        console.log('Failed to fetch PnL history:', e);
        setPnlHistory([]);
      } finally {
        //setLoadingPnl(false);
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
  const getCurrentPriceNumber = (trade: Trade) => {
    const marketOddsData = marketOdds[trade.marketId];
    if (!marketOddsData) return 0;
    
    if (trade.outcome.toLowerCase().includes('yes') && marketOddsData.oddsYes !== undefined) {
      return Number(marketOddsData.oddsYes) / Math.pow(2, 64);
    } else if (trade.outcome.toLowerCase().includes('no') && marketOddsData.oddsNo !== undefined) {
      return Number(marketOddsData.oddsNo) / Math.pow(2, 64);
    }
    return 0;
  };

  // Helper function to get current price for a position
  const getCurrentPrice = (trade: Trade) => {
    const marketOddsData = marketOdds[trade.marketId];
    if (!marketOddsData) return '--';
    
    if (trade.outcome.toLowerCase().includes('yes') && marketOddsData.oddsYes !== undefined) {
      const price = Number(marketOddsData.oddsYes) / Math.pow(2, 64);
      return formatPrice(price);
    } else if (trade.outcome.toLowerCase().includes('no') && marketOddsData.oddsNo !== undefined) {
      const price = Number(marketOddsData.oddsNo) / Math.pow(2, 64);
      return formatPrice(price);
    }
    return '--';
  };

  // Calculate total portfolio value using current positions
  const totalPositionsValue = currentPositions.reduce((sum, position) => sum + position.positionValue, 0);
  const totalPortfolio = cash + totalPositionsValue;
  React.useEffect(() => {
    setPortfolioValue(totalPortfolio.toFixed(2));
  }, [totalPortfolio, setPortfolioValue]);

  // Calculate all-time P/L using deposits vs current portfolio value
  const allTimePL = totalPortfolio - totalDeposits;
  const allTimePLPercent = totalDeposits > 0 ? (allTimePL / totalDeposits) * 100 : 0;

  useEffect(() => {
    if (account && balance !== undefined && Number(balance) === 0) {
      const parsedAmount = parseAmountToWei("100");
      const transaction = prepareContractCall({
        contract: tokenContract,
        method: "function mint(address account, uint256 amount)",
        params: [account.address, parsedAmount],
      });
      sendTransaction(transaction, {
        onSuccess: () => {
          refetch();
        }
      });
    }
  }, [account, balance, refetch, sendTransaction]);
// }, [account, balance]);

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center pt-8 w-full">
        <div className="max-w-7xl w-full mx-auto px-4">
          {/* Portfolio Balance Card */}
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-8 mb-8 flex items-start justify-start w-[700px] max-w-full" style={{ height: 176 }}>
            <div>
              <div className="flex items-center mb-2">
                <span className="uppercase tracking-widest text-gray-500 font-semibold text-xs md:text-sm">Portfolio</span>
              </div>
              <div className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">${totalPortfolio.toFixed(2)}</div>
              <div className="text-gray-500 font-semibold text-xs md:text-sm uppercase tracking-widest mb-1">Profit/Loss</div>
              <div className={
                allTimePL > 0 ? "text-green-600 font-semibold text-sm md:text-lg" :
                allTimePL < 0 ? "text-red-600 font-semibold text-sm md:text-lg" :
                "text-gray-500 font-semibold text-sm md:text-lg"
              }>
                {allTimePL >= 0 ? "+" : "-"}${Math.abs(allTimePL).toFixed(2)}
                <span className="ml-1">
                  ({Math.abs(allTimePLPercent).toFixed(2)}%)
                </span>
                <span className="text-gray-400 font-normal text-xs md:text-base ml-1">All-Time</span>
              </div>
            </div>
            <div className="flex flex-col items-start ml-20">
              <span className="text-gray-500 font-semibold text-xs md:text-sm uppercase tracking-widest mb-1">Cash</span>
              <span className="text-gray-900 font-bold text-xs md:text-[14px] mb-4">${cash.toFixed(2)}</span>
              <span className="text-gray-500 font-semibold text-xs md:text-sm uppercase tracking-widest mb-1 block" style={{ paddingTop: 12 }}>Bet Value</span>
              <span className="text-gray-900 font-bold text-xs md:text-[14px] mb-4">${totalPositionsValue.toFixed(2)}</span>
            </div>
            </div>

          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            {/* Tab Buttons */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('current')}
                className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
                  activeTab === 'current'
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Current
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
                  activeTab === 'history'
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Trade History
              </button>
            </div>

            {/* Tab Content */}
            <div className="overflow-x-auto">
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
                  {activeTab === 'history' && (
                    <>
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-600 tracking-wider">MARKET</th>
                            <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-left" colSpan={2}>
                              AVG <span className="mx-1">→</span> NOW <span title="Average price paid vs. current price" className="ml-1">&#9432;</span>
                            </th>
                            <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-center">BET</th>
                            <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-center">TO WIN</th>
                            <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-center">VALUE</th>
                            <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-center">P/L</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {trades.map((trade) => (
                            <tr key={trade.id} className="hover:bg-gray-50 transition">
                              {/* Market cell */}
                              <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                                <div>
                                  <div className={`font-semibold text-xs md:text-sm ${getOutcomeColor(trade.outcome)}`}>
                                    {trade.outcome} {formatPrice(trade.avgPrice)}¢ <span className="text-gray-500 font-normal ml-1 text-[10px] md:text-xs">{trade.shares.toFixed(2)} shares</span>
                                  </div>
                                  <div className="text-gray-900 font-medium text-xs md:text-sm leading-tight">{trade.marketTitle}</div>
                                </div>
                              </td>
                              {/* Avg → Now */}
                              <td className="px-3 md:px-6 pr-3 py-3 md:py-4 text-left text-gray-900 text-xs md:text-base" colSpan={2}>
                                {formatPrice(trade.avgPrice)}¢ <span className="mx-1">→</span> {getCurrentPrice(trade)}¢
                              </td>
                              {/* Bet */}
                              <td className="px-3 md:px-6 py-3 md:py-4 text-center text-gray-900 text-xs md:text-base">
                                ${trade.betAmount.toFixed(2)}
                              </td>
                              {/* To Win */}
                              <td className="px-3 md:px-6 py-3 md:py-4 text-center text-gray-900 text-xs md:text-base">
                                ${trade.toWin.toFixed(2)}
                              </td>
                              {/* Value */}
                              <td className="px-3 md:px-6 py-3 md:py-4 text-center text-xs md:text-base font-bold" style={{color: (trade.shares * getCurrentPriceNumber(trade)) > trade.betAmount ? '#16a34a' : '#dc2626'}}>
                                ${ (trade.shares * getCurrentPriceNumber(trade)).toFixed(2) }
                              </td>
                              {/* P/L */}
                              <td className="px-3 md:px-6 py-3 md:py-4 text-center text-xs md:text-base font-bold" style={{
                                color: (trade.shares * getCurrentPriceNumber(trade) - trade.betAmount) > 0 ? '#16a34a' :
                                      (trade.shares * getCurrentPriceNumber(trade) - trade.betAmount) < 0 ? '#dc2626' : '#6b7280'
                              }}>
                                {(() => {
                                  const pl = trade.shares * getCurrentPriceNumber(trade) - trade.betAmount;
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

                  {activeTab === 'current' && (
                    <>
                      {currentPositionsLoading ? (
                        <div className="text-center text-gray-500 py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                          Loading current positions...
                        </div>
                      ) : (
                        <>
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-600 tracking-wider">MARKET</th>
                                <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-left" colSpan={2}>
                                  NOW <span title="Current price" className="ml-1">&#9432;</span>
                                </th>
                                <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-center">SHARES</th>
                                <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-center">VALUE</th>
                                <th className="px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-xs font-semibold text-gray-600 text-center">POTENTIAL</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {currentPositions.map((position, index) => (
                                <tr key={index} className="hover:bg-gray-50 transition">
                                  {/* Market cell */}
                                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                                    <div>
                                      <div className={`font-semibold text-xs md:text-sm ${getOutcomeColor(position.outcome)}`}>
                                        {position.outcome} {formatPrice(position.currentPrice)}¢ <span className="text-gray-500 font-normal ml-1 text-[10px] md:text-xs">{position.shares.toFixed(2)} shares</span>
                                      </div>
                                      <div className="text-gray-900 font-medium text-xs md:text-sm leading-tight">{position.marketTitle}</div>
                                    </div>
                                  </td>
                                  {/* Current Price */}
                                  <td className="px-3 md:px-6 pr-3 py-3 md:py-4 text-left text-gray-900 text-xs md:text-base" colSpan={2}>
                                    {formatPrice(position.currentPrice)}¢
                                  </td>
                                  {/* Shares */}
                                  <td className="px-3 md:px-6 py-3 md:py-4 text-center text-gray-900 text-xs md:text-base">
                                    {position.shares.toFixed(2)}
                                  </td>
                                  {/* Value */}
                                  <td className="px-3 md:px-6 py-3 md:py-4 text-center text-xs md:text-base font-bold" style={{color: position.positionValue > 0 ? '#16a34a' : '#dc2626'}}>
                                    ${position.positionValue.toFixed(2)}
                                  </td>
                                  {/* Potential (if outcome resolves to Yes, they win $1 per share) */}
                                  <td className="px-3 md:px-6 py-3 md:py-4 text-center text-xs md:text-base font-bold text-green-600">
                                    ${position.shares.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* If no current positions, show a message */}
                          {currentPositions.length === 0 && (
                            <div className="text-center text-gray-500 py-12">
                              No current positions. Your active positions will appear here.
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="w-full h-8 bg-[#f8f9fa]"></div>
    </div>
  );
} 