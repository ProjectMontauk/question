"use client";

import React from "react";
import { useRouter } from "next/navigation";

const Homepage = () => {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center w-full pt-10">
      <h1 className="text-4xl font-bold mb-4 text-center w-full">Welcome to Tinfoil</h1>
      <div className="text-xl text-gray-600 mb-8 text-center w-full">
        A home for honest debate about anything on the internet
      </div>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Deposit Card */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-xs w-full">
          <div className="flex items-center mb-3">
            {/* Example icon, replace with a better one if desired */}
            <svg className="w-4 h-4 text-gray-700 mr-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3" /></svg>
            <h2 className="text-xl font-bold text-gray-900">Deposit</h2>
          </div>
          <p className="text-gray-700 mb-4 text-sm">Mint funds to your account so you can participate in markets</p>
          <button className="w-full bg-[#171A22] text-white py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition" onClick={() => router.push("/deposit")}>Deposit Funds</button>
        </div>
        {/* Prediction Markets Card */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-xs w-full">
          <div className="flex items-center mb-3">
            <svg className="w-4 h-4 text-gray-700 mr-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" /></svg>
            <h2 className="text-xl font-bold text-gray-900">Prediction Markets</h2>
          </div>
          <p className="text-gray-700 mb-4 text-sm">Make predictions and earn rewards by contributing to collective knowledge.</p>
          <button className="w-full bg-[#171A22] text-white py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition" onClick={() => router.push("/markets")}>View Prediction Markets</button>
        </div>
        {/* Portfolio Balance Card */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-xs w-full">
          <div className="flex items-center mb-3">
            <svg className="w-4 h-4 text-gray-700 mr-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" /></svg>
            <h2 className="text-xl font-bold text-gray-900">Portfolio Balance</h2>
          </div>
          <p className="text-gray-700 mb-4 text-sm">Track your prediction market positions, performance, and earnings.</p>
          <button className="w-full bg-[#171A22] text-white py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition" onClick={() => router.push("/portfolio")}>View Portfolio</button>
        </div>
      </div>
    </div>
  );
};

export default Homepage; 