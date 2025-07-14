"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client } from "../../../src/client";
import { polygonAmoy } from "thirdweb/chains";
import { getAllMarkets, Market } from "../../../src/data/markets";
import Navbar from "../../../components/Navbar";

// MarketCard component that fetches its own odds
const MarketCard = ({ market }: { market: Market }) => {
  const router = useRouter();
  
  // Create contract instance for this specific market
  const marketContractInstance = getContract({
    client,
    chain: polygonAmoy,
    address: market.contractAddress,
  });

  // Fetch current odds for Yes (0) and No (1) positions for this specific market
  const { data: oddsYes } = useReadContract({
    contract: marketContractInstance,
    method: "function odds(uint256 _outcome) view returns (int128)",
    params: [0n],
  });
  
  const { data: oddsNo } = useReadContract({
    contract: marketContractInstance,
    method: "function odds(uint256 _outcome) view returns (int128)",
    params: [1n],
  });

  // Convert odds to probabilities
  const yesProbability = oddsYes !== undefined ? Number(oddsYes) / Math.pow(2, 64) : 0;
  const noProbability = oddsNo !== undefined ? Number(oddsNo) / Math.pow(2, 64) : 0;

  return (
    <div
      className="bg-white rounded-xl shadow border border-gray-200 p-5 w-1/2 cursor-pointer hover:shadow-lg transition"
      onClick={() => router.push(`/markets/${market.id}`)}
      role="button"
      tabIndex={0}
      onKeyPress={e => { if (e.key === 'Enter') router.push(`/markets/${market.id}`); }}
    >
      <div className="mb-4">
        <Image
          src={market.image}
          alt={market.title}
          width={400}
          height={200}
          className="w-full h-48 rounded-lg object-cover object-top"
        />
      </div>
      <div className="mb-3">
        <h3 className="text-xl font-bold text-gray-900">{market.title}</h3>
      </div>
      <div className="mb-0">
        <div className="grid grid-cols-4 gap-2 items-center">
          <div className="text-sm font-semibold text-black col-span-3">{market.outcomes[0]}:</div>
          <div className="text-lg font-bold text-green-600 text-right bg-green-100 rounded pr-7 px-1">
            {yesProbability > 0 ? `${Math.round(yesProbability * 100)}%` : '--'}
          </div>
          <div className="text-sm font-semibold text-black col-span-3">{market.outcomes[1]}:</div>
          <div className="text-lg font-bold text-red-600 text-right bg-red-100 rounded pr-7 px-1">
            {noProbability > 0 ? `${Math.round(noProbability * 100)}%` : '--'}
          </div>
        </div>
      </div>
    </div>
  );
};

const MarketsContent = () => {
  const searchParams = useSearchParams();
  const category = searchParams?.get('category') || 'all';
  
  // Get all markets
  const allMarkets = getAllMarkets();
  
  // Filter markets based on category
  const getFilteredMarkets = () => {
    const historyMarkets = ['jfk', 'moon-landing', 'alien'];
    const scienceMarkets = ['vaccine', 'string-theory', 'covid-vaccine'];
    
    switch (category) {
      case 'history':
        return allMarkets.filter(market => historyMarkets.includes(market.id));
      case 'science':
        return allMarkets.filter(market => scienceMarkets.includes(market.id));
      default:
        return allMarkets;
    }
  };
  
  const filteredMarkets = getFilteredMarkets();

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center w-full pt-8">
      {/* Title for each category */}
      <div className="w-full max-w-5xl">
        {category === 'all' && (
          <h1 className="text-2xl font-bold mb-4 text-left ml-4">All Markets</h1>
        )}
        {category === 'history' && (
          <h1 className="text-2xl font-bold mb-4 text-left ml-4">History Markets</h1>
        )}
        {category === 'science' && (
          <h1 className="text-2xl font-bold mb-4 text-left ml-4">Science Markets</h1>
        )}
      </div>
      {/* Active Markets Section */}
      <div className="w-full flex flex-col items-center">
        <div className="flex flex-col gap-6 w-full max-w-5xl">
          {/* Display markets in rows of 2 */}
          {filteredMarkets.length > 0 ? (
            filteredMarkets.reduce((rows: Market[][], market: Market, index: number) => {
              if (index % 2 === 0) {
                rows.push([market]);
              } else {
                rows[rows.length - 1].push(market);
              }
              return rows;
            }, []).map((row: Market[], rowIndex: number) => (
              <div key={rowIndex} className="flex flex-col sm:flex-row gap-6 w-full">
                {row.map((market: Market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
                  </div>
                ))
          ) : (
            <div className="text-center text-gray-500 text-lg">
              No markets found for this category.
                      </div>
                          )}
                        </div>
      </div>
    </div>
  );
};

const MarketsPage = () => {
  return (
    <div>
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">Loading markets...</div>}>
        <MarketsContent />
      </Suspense>
    </div>
  );
};

export default MarketsPage; 