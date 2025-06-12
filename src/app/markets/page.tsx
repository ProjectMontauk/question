"use client";

import Navbar from "../../../components/Navbar";
import React, { useState } from "react";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { tokenContract, marketContract } from "../../../constants/contracts";
const LmLSMR_CONTRACT_ADDRESS = "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a";
import { formatOdds } from "../../utils/formatOdds";

export default function MarketsPage() {
  const account = useActiveAccount();
  const { data: balance } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });
  const { mutate: sendTransaction, status } = useSendTransaction();

  // Odds for Yes (0) and No (1)
  const { data: oddsYes, isPending: isPendingYes } = useReadContract({
    contract: marketContract,
    method: "function odds(uint256 _outcome) view returns (int128)",
    params: [0n],
  });
  const { data: oddsNo, isPending: isPendingNo } = useReadContract({
    contract: marketContract,
    method: "function odds(uint256 _outcome) view returns (int128)",
    params: [1n],
  });

  const [showRules, setShowRules] = useState(false);
  const rulesShort = "The market will resolve 'Yes' if the CIA aided in the planning or execution of John F. Kennedy's Assassination. This means that a group inside the CIA or received funding from the CIA participated in the planning/execution of the 35th President's assassination. Otherwise, the market will resolve 'No.' This means that no personnel inside or funded by the CIA aided the murder of John F. Kennedy.";
  const rulesFull = "The market will resolve 'Yes' if the CIA aided in the planning or execution of John F. Kennedy's Assassination. This means that a group inside the CIA or received funding from the CIA participated in the planning/execution of the 35th President's assassination. Otherwise, the market will resolve 'No.' This means that no personnel inside or funded by the CIA aided the murder of John F. Kennedy.";

  // Get only the first sentence for the collapsed view
  const firstLine = rulesShort.split(".")[0] + ".";

  const handleApprove = () => {
    if (!account || !balance) return;
    const transaction = prepareContractCall({
      contract: tokenContract,
      method: "function approve(address spender, uint256 value)",
      params: [LmLSMR_CONTRACT_ADDRESS, balance],
    });
    sendTransaction(transaction);
  };

  const [buyYesAmount, setBuyYesAmount] = useState("");
  const [buyNoAmount, setBuyNoAmount] = useState("");
  const [buyFeedback, setBuyFeedback] = useState<string | null>(null);

  // For Buy Yes
  const { mutate: sendBuyYesTransaction, status: buyYesStatus } = useSendTransaction();
  // For Buy No
  const { mutate: sendBuyNoTransaction, status: buyNoStatus } = useSendTransaction();

  const handleBuyYes = (amount: string) => {
    if (!amount) return;
    const parsedAmount = BigInt(Math.floor(Number(amount) * Math.pow(2, 64)));
    console.log(parsedAmount);
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function buy(uint256 _outcome, int128 _amount) returns (int128 _price)",
      params: [0n, parsedAmount],
    });
    sendBuyYesTransaction(transaction, {
      onError: (error) => {
        setBuyFeedback("Purchase failed. Please try again.");
        console.error("Buy transaction error:", error);
      },
      onSuccess: (data) => {
        setBuyFeedback("Purchase successful!");
        setBuyYesAmount("");
        console.log("Buy transaction success:", data);
      },
      onSettled: () => {
        setTimeout(() => setBuyFeedback(null), 4000);
      }
    });
  };

  const handleBuyNo = (amount: string) => {
    if (!amount) return;
    const parsedAmount = BigInt(Math.floor(Number(amount) * Math.pow(2, 64)));
    console.log("Bought amount: ", parsedAmount);
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function buy(uint256 _outcome, int128 _amount) returns (int128 _price)",
      params: [1n, parsedAmount],
    });
    console.log("Buy No transaction:", transaction);
    sendBuyNoTransaction(transaction, {
      onError: (error) => {
        setBuyFeedback("Purchase failed. Please try again.");
        console.error("Buy transaction error:", error);
      },
      onSuccess: (data) => {
        setBuyFeedback("Purchase successful!");
        setBuyNoAmount("");
        console.log("Buy transaction success:", data);
      },
      onSettled: () => {
        setTimeout(() => setBuyFeedback(null), 4000);
      }
    });
  };

  const [sellYesAmount, setSellYesAmount] = useState("");
  const [sellNoAmount, setSellNoAmount] = useState("");
  // For Sell Yes
  const { mutate: sendSellYesTransaction, status: sellYesStatus } = useSendTransaction();
  // For Sell No
  const { mutate: sendSellNoTransaction, status: sellNoStatus } = useSendTransaction();

  const handleSellYes = (amount: string) => {
    if (!amount) return;
    const parsedAmount = BigInt(Math.floor(Number(amount) * Math.pow(2, 64)));
    console.log("Sell Yes transaction:", parsedAmount);
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function sell(uint256 _outcome, int128 _amount) returns (int128 refund)",
      params: [0n, parsedAmount],
    });
    sendSellYesTransaction(transaction, {
      onError: (error) => {
        setBuyFeedback("Sell failed. Please try again.");
        console.error("Sell transaction error:", error);
      },
      onSuccess: (data) => {
        setBuyFeedback("Sell successful!");
        setSellYesAmount("");
        console.log("Sell transaction success:", data);
      },
      onSettled: () => {
        setTimeout(() => setBuyFeedback(null), 4000);
      }
    });
  };

  const handleSellNo = (amount: string) => {
    if (!amount) return;
    const parsedAmount = BigInt(Math.floor(Number(amount) * Math.pow(2, 64)));
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function sell(uint256 _outcome, int128 _amount) returns (int128 refund)",
      params: [1n, parsedAmount],
    });
    console.log("Sell No transaction:", transaction);
    sendSellNoTransaction(transaction, {
      onError: (error) => {
        setBuyFeedback("Sell failed. Please try again.");
        console.error("Sell transaction error:", error);
      },
      onSuccess: (data) => {
        setBuyFeedback("Sell successful!");
        setSellNoAmount("");
        console.log("Sell transaction success:", data);
      },
      onSettled: () => {
        setTimeout(() => setBuyFeedback(null), 4000);
      }
    });
  };

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-[#f8f9fa] flex justify-center items-start pt-8 w-full">
        <div className="bg-white rounded-xl shadow border border-gray-200 p-8 flex flex-col min-h-[500px] max-w-5xl w-full mx-auto">
          <h1 className="text-xl font-bold text-[#171A22] mb-4">Did the CIA aid in the planning or execution of John F. Kennedy's Assassination?</h1>
          <div className="flex flex-col items-start mb-8">
            <button
              className="bg-[#171A22] text-white px-6 py-1 rounded-lg font-medium text-sm shadow hover:bg-[#232635] transition mb-1 whitespace-nowrap disabled:opacity-50"
              onClick={handleApprove}
              disabled={!account || !balance || status === "pending"}
            >
              {status === "pending" ? "Approving..." : "Approve Bets"}
            </button>
          </div>
          {/* Odds boxes section */}
          <div className="flex justify-center items-center gap-8 my-6">
            <div className="bg-[#f8f9fa] border border-gray-300 rounded-lg px-10 py-6 flex flex-col items-center min-w-[170px]">
              <span className="text-lg font-semibold text-[#171A22] mb-2">Yes</span>
              <span className="text-2xl font-bold text-[#171A22]">{isPendingYes ? "..." : formatOdds(oddsYes)}</span>
              <div className="flex items-center gap-2 mt-4 w-full">
                <input
                  type="number"
                  min="0"
                  placeholder="Enter Bet Amount"
                  value={buyYesAmount}
                  onChange={e => setBuyYesAmount(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-base"
                />
                <button
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50"
                  onClick={() => handleBuyYes(buyYesAmount)}
                  disabled={!buyYesAmount || buyYesStatus === "pending"}
                >
                  {buyYesStatus === "pending" ? "Buying..." : "Buy Yes"}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 w-full">
                <input
                  type="number"
                  min="0"
                  placeholder="Enter Sell Amount"
                  value={sellYesAmount}
                  onChange={e => setSellYesAmount(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-base"
                />
                <button
                  className="bg-white border border-green-600 text-green-700 font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50"
                  onClick={() => handleSellYes(sellYesAmount)}
                  disabled={!sellYesAmount || sellYesStatus === "pending"}
                >
                  {sellYesStatus === "pending" ? "Selling..." : "Sell Yes"}
                </button>
              </div>
            </div>
            <div className="bg-[#f8f9fa] border border-gray-300 rounded-lg px-10 py-6 flex flex-col items-center min-w-[170px]">
              <span className="text-lg font-semibold text-[#171A22] mb-2">No</span>
              <span className="text-2xl font-bold text-[#171A22]">{isPendingNo ? "..." : formatOdds(oddsNo)}</span>
              <div className="flex items-center gap-2 mt-4 w-full">
                <input
                  type="number"
                  min="0"
                  placeholder="Enter Bet Amount"
                  value={buyNoAmount}
                  onChange={e => setBuyNoAmount(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                />
                <button
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50"
                  onClick={() => handleBuyNo(buyNoAmount)}
                  disabled={!buyNoAmount || buyNoStatus === "pending"}
                >
                  {buyNoStatus === "pending" ? "Buying..." : "Buy No"}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 w-full">
                <input
                  type="number"
                  min="0"
                  placeholder="Enter Sell Amount"
                  value={sellNoAmount}
                  onChange={e => setSellNoAmount(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                />
                <button
                  className="bg-white border border-red-600 text-red-700 font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50"
                  onClick={() => handleSellNo(sellNoAmount)}
                  disabled={!sellNoAmount || sellNoStatus === "pending"}
                >
                  {sellNoStatus === "pending" ? "Selling..." : "Sell No"}
                </button>
              </div>
            </div>
          </div>
          {buyFeedback && (
            <div className={`text-center my-4 ${buyFeedback.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{buyFeedback}</div>
          )}
          {/* Collapsible Rules section */}
          <div className="mt-8 bg-white rounded-lg p-6">
            <h2 className="text-lg font-bold mb-2">Rules</h2>
            <p className="text-gray-600 text-sm mb-2">
              {showRules ? rulesFull : firstLine}
            </p>
            <button
              className="text-blue-600 text-sm font-medium flex items-center gap-1 focus:outline-none mb-2"
              onClick={() => setShowRules((prev) => !prev)}
            >
              {showRules ? "Read Less" : "Read More"}
              <span className={showRules ? "rotate-180" : ""}>▼</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 