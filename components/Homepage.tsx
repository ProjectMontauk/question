"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client } from "../src/client";
import { polygonAmoy } from "thirdweb/chains";
import { getAllMarkets, Market } from "../src/data/markets";

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
      className="bg-white rounded-xl shadow border border-gray-200 p-5 w-full sm:w-1/2 cursor-pointer hover:shadow-lg transition"
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

const Homepage = () => {
  // Get all markets
  const markets = getAllMarkets();
  
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center w-full pt-5 md:pt-10">
      <h1 className="text-2xl md:text-4xl font-bold mb-4 text-center w-full">Welcome to Tinfoil!</h1>
      <div className="text-base md:text-xl text-gray-600 mb-0 text-center w-full">
        A home for honest debate about anything.
        <br />
        Bet on what you believe, challenge convention, and earn for being right.
      </div>
      {/* Active Markets Section */}
      <div className="w-full flex flex-col items-center mt-4 md:mt-10">
        <div className="flex flex-col gap-6 w-full max-w-5xl">
          {/* First row - JFK and Moon Landing */}
          <div className="flex flex-col sm:flex-row gap-6 w-full">
            {markets.slice(0, 2).map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
          {/* Second row - Alien and Vaccine markets */}
          {markets.length > 2 && (
            <div className="flex flex-col sm:flex-row gap-6 w-full">
              {markets.slice(2, 4).map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}
          {/* Third row - String Theory and COVID Vaccine markets */}
          {markets.length > 4 && (
            <div className="flex flex-col sm:flex-row gap-6 w-full">
              {markets.slice(4, 6).map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="w-full h-8 bg-[#f8f9fa]"></div>
    </div>
  );
};

export default Homepage; 