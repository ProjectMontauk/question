"use client";

import Navbar from "../../../components/Navbar";
import React, { useState } from "react";
import { useSendTransaction, useActiveAccount, useReadContract } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { tokenContract } from "../../../constants/contracts";
import { parseAmountToWei } from "../../utils/parseAmountToWei";

export default function DepositPage() {
  const [amount, setAmount] = useState("");
  const { mutate: sendTransaction, status } = useSendTransaction();
  const account = useActiveAccount();

  const { data: balance, isPending } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });

  function formatBalance(balance: bigint | undefined): string {
    if (!balance) return "--";
    // Divide by 10^18 and show up to 4 decimals
    return (Number(balance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  const handleMint = () => {
    if (!account || !amount) return;
    const parsedAmount = parseAmountToWei(amount);
    const transaction = prepareContractCall({
      contract: tokenContract,
      method: "function mint(address account, uint256 amount)",
      params: [account.address, parsedAmount],
    });
    sendTransaction(transaction);
  };

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center pt-12 w-full">
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-md w-full mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Mint Funds</h2>
          <div className="flex gap-3">
            <input
              type="number"
              min="0"
              placeholder="Amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171A22] text-base"
            />
            <button
              className="bg-[#171A22] text-white px-6 py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition disabled:opacity-50"
              onClick={handleMint}
              disabled={!account || !amount || status === "pending"}
            >
              {status === "pending" ? "Minting..." : "Mint"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Mint amount is denominated in Dai.</p>
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Portfolio Balance</h2>
          <div className="flex items-center justify-center h-16">
            <span className="text-2xl text-gray-700 font-semibold">$</span>
            <span className="text-2xl text-gray-700 font-semibold">
              {isPending ? "..." : formatBalance(balance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}