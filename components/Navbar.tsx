"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ConnectButton, useActiveAccount, useReadContract } from "thirdweb/react";
import { client } from "../src/client";
import { useRouter } from "next/navigation";
import { tokenContract, getContractsForMarket } from "../constants/contracts";
import { inAppWallet} from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { readContract } from "thirdweb";

// TODO: Replace this with the actual ThirdWeb inAppWallet import
// import { InAppWalletButton } from "thirdweb-package-path";

// Add Trade type based on schema.prisma
/*
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
*/

// Interface for current positions
interface CurrentPosition {
  marketId: string;
  marketTitle: string;
  outcome: string;
  shares: number;
  currentPrice: number;
  positionValue: number;
}

function formatBalance(balance: bigint | undefined): string {
  if (!balance) return "0";
  // Divide by 10^18 and show decimal places only when needed
  const amount = Number(balance) / 1e18;
  return amount % 1 === 0 
    ? amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const Navbar = () => {
  const router = useRouter();
  const account = useActiveAccount();
  const [portfolioValue, setPortfolioValue] = useState<string>("--");
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const { data: balance, isPending, refetch } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });

  const wallets = [
    inAppWallet({
      auth: {
        options: ["google", "email","facebook", "phone", "apple", "passkey"],
      },
      smartAccount: {
        chain: polygonAmoy,
        sponsorGas: true,
      },
    }),
  ];

  // Polling mechanism for cash balance updates
  useEffect(() => {
    if (!account?.address) return;

    // Initial fetch
    refetch();

    // Set up polling interval (check every 3 seconds)
    const interval = setInterval(() => {
      refetch();
    }, 3000);

    // Cleanup interval on unmount or account change
    return () => clearInterval(interval);
  }, [account?.address, refetch]);

  // Fetch current positions across all markets (same method as portfolio page)
  const fetchCurrentPositions = useCallback(async () => {
    if (!account?.address) {
      return [];
    }

    try {
      const positions: CurrentPosition[] = [];
      const { getAllMarkets } = await import('../src/data/markets');
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

      return positions;
    } catch (error) {
      console.error('Failed to fetch current positions:', error);
      return [];
    }
  }, [account?.address]);

  // Fetch and calculate portfolio value using current positions (same as portfolio page)
  useEffect(() => {
    const loadPortfolioValue = async () => {
      if (!account?.address) {
        setPortfolioValue("--");
        setPortfolioLoading(false);
        return;
      }
      try {
        setPortfolioLoading(true);
        const cash = balance ? Number(balance) / 1e18 : 0;
        
        // Fetch current positions using the same method as portfolio page
        const currentPositions = await fetchCurrentPositions();
        
        // Calculate total positions value using current positions
        const totalPositionsValue = currentPositions.reduce((sum, position) => sum + position.positionValue, 0);
        const totalPortfolio = cash + totalPositionsValue;
        
        setPortfolioValue(totalPortfolio.toFixed(2));
        setPortfolioLoading(false);
      } catch {
        setPortfolioValue("--");
        setPortfolioLoading(false);
      }
    };
    loadPortfolioValue();
    // Only update when account or balance changes
  }, [account?.address, balance, fetchCurrentPositions]);

  return (
    <nav className="w-full border-b border-gray-200 bg-white">
      <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between px-4 md:px-8 py-1">
        <div className="ml-0 flex flex-col items-start">
          <h1 className="text-3xl font-bold text-[#171A22] mt-4">Tinfoil</h1>
          <div className="flex gap-0 md:gap-0 mt-1 -ml-2">
            <button
              className="py-1 px-1 md:px-2 bg-white text-[#171A22] rounded-md text-[10px] md:text-sm font-semibold hover:bg-gray-100 transition border-none shadow-none text-left whitespace-nowrap"
              style={{ minWidth: 0 }}
              onClick={() => router.push("/markets")}
            >
              All Markets
            </button>
            <button
              className="py-1 px-1 md:px-2 bg-white text-[#171A22] rounded-md text-[10px] md:text-sm font-semibold hover:bg-gray-100 transition border-none shadow-none text-left whitespace-nowrap"
              style={{ minWidth: 0 }}
              onClick={() => router.push("/markets?category=history")}
            >
              History
            </button>
            <button
              className="py-1 px-1 md:px-2 bg-white text-[#171A22] rounded-md text-[10px] md:text-sm font-semibold hover:bg-gray-100 transition border-none shadow-none text-left whitespace-nowrap"
              style={{ minWidth: 0 }}
              onClick={() => router.push("/markets?category=science")}
            >
              Science
            </button>
            <button
              className="py-1 px-1 md:px-2 bg-white text-[#171A22] rounded-md text-[10px] md:text-sm font-semibold hover:bg-gray-100 transition border-none shadow-none text-left whitespace-nowrap"
              style={{ minWidth: 0 }}
              onClick={() => router.push("/market-ideas")}
            >
              New
            </button>
            <button
              className="py-1 px-1 md:px-2 bg-white text-[#171A22] rounded-md text-[10px] md:text-sm font-semibold hover:bg-gray-100 transition border-none shadow-none text-left whitespace-nowrap"
              style={{ minWidth: 0 }}
              onClick={() => router.push("/portfolio")}
            >
              Portfolio
            </button>
          </div>
        </div>
        <div className="flex items-center gap-0">
          <button
            className="hidden md:flex flex-col items-center justify-center bg-white px-2 py-1 rounded transition-colors duration-200 cursor-pointer focus:outline-none hover:bg-gray-200"
            style={{ boxShadow: "none", minWidth: 0 }}
            onClick={() => router.push("/portfolio")}
          >
            <span className="text-[#171A22] font-medium text-sm">Portfolio</span>
            <span className="text-green-600 font-semibold text-sm">
              {portfolioLoading || portfolioValue === "--" ? "$--" : `$${Number(portfolioValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </span>
          </button>
          <button
            className="hidden md:flex flex-col items-center justify-center bg-white px-2 py-1 pr-4 m-0 p-0 rounded transition-colors duration-200 cursor-pointer focus:outline-none hover:bg-gray-200 text-center"
            style={{ boxShadow: "none", minWidth: 0, margin: 0 }}
            onClick={() => router.push("/portfolio")}
          >
            <span className="text-[#171A22] font-medium text-sm">Cash</span>
            <span className="text-green-600 font-semibold text-sm">
              {(!account?.address || isPending) ? "$--" : `$${formatBalance(balance)}`}
            </span>
          </button>
          <div className="flex scale-75 origin-left">
            <ConnectButton 
              client={client} 
              wallets={wallets} 
              connectButton={{
                label: "Sign In",
                className: "bg-black text-white px-4 py-2 rounded transition-colors duration-200 focus:outline-none hover:bg-gray-800 text-xs font-semibold m-0"
              }}
            />
          </div>
          {/* Example: <InAppWalletButton /> */}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
