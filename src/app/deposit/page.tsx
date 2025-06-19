"use client";

import Navbar from "../../../components/Navbar";
import React, { useState } from "react";
import { useSendTransaction, useActiveAccount, useReadContract } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { tokenContract, conditionalTokensContract } from "../../../constants/contracts";
import { parseAmountToWei } from "../../utils/parseAmountToWei";

const LmLSMR_CONTRACT_ADDRESS = "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a";

export default function DepositPage() {
  const [amount, setAmount] = useState("");
  const { mutate: sendTransaction, status } = useSendTransaction();
  const account = useActiveAccount();

  // For getCollectionId card
  const [conditionId, setConditionId] = useState("");
  const [parentCollectionId, setParentCollectionId] = useState("0000000000000000000000000000000000000000000000000000000000000000");
  const [indexSet, setIndexSet] = useState("1");
  const [shouldFetch, setShouldFetch] = useState(false);

  const [collectionIdResult, setCollectionIdResult] = useState<string | null>(null);
  const [isCollectionIdPending, setIsCollectionIdPending] = useState(false);

  // For getPositionId card
  const [collateralToken, setCollateralToken] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [positionIdResult, setPositionIdResult] = useState<string | null>(null);
  const [isPositionIdPending, setIsPositionIdPending] = useState(false);

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

  const handleApprove = () => {
    if (!account || !balance) return;
    const transaction = prepareContractCall({
      contract: tokenContract,
      method: "function approve(address spender, uint256 value)",
      params: [LmLSMR_CONTRACT_ADDRESS, balance],
    });
    sendTransaction(transaction);
  };

  // Helper to ensure '0x' is only prepended if missing and pad to 64 characters
  function ensureHexPrefix(str: string) {
    const cleanStr = str.replace('0x', '').toLowerCase();
    // Pad with zeros to ensure 64 characters (32 bytes)
    const paddedStr = cleanStr.padStart(64, '0');
    return '0x' + paddedStr;
  }

  const handleGetCollectionId = async () => {
    setIsCollectionIdPending(true);
    
    // Format parameters properly
    const formattedParentCollectionId = ensureHexPrefix(parentCollectionId);
    const formattedConditionId = ensureHexPrefix(conditionId);
    
    console.log('GetCollectionId called with params:', {
      parentCollectionId: formattedParentCollectionId,
      conditionId: formattedConditionId,
      indexSet
    });
    
    try {
      const result = await readContract({
        contract: conditionalTokensContract,
        method: "function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet) view returns (bytes32)",
        params: [
          formattedParentCollectionId as `0x${string}`,
          formattedConditionId as `0x${string}`,
          BigInt(indexSet)
        ],
      });
      setCollectionIdResult(result as string);
    } catch (err) {
      console.error("Error details:", err);
      setCollectionIdResult("Error fetching CollectionId");
    }
    setIsCollectionIdPending(false);
  };

  const handleGetPositionId = async () => {
    setIsPositionIdPending(true);
    
    // Format collectionId properly
    const formattedCollectionId = ensureHexPrefix(collectionId);
    
    console.log('GetPositionId called with params:', {
      collateralToken,
      collectionId: formattedCollectionId
    });
    
    try {
      const result = await readContract({
        contract: conditionalTokensContract,
        method: "function getPositionId(address collateralToken, bytes32 collectionId) pure returns (uint256)",
        params: [
          collateralToken as `0x${string}`,
          formattedCollectionId as `0x${string}`
        ],
      });
      setPositionIdResult(result.toString());
    } catch (err) {
      console.error("PositionId Error details:", err);
      setPositionIdResult("Error fetching PositionId");
    }
    setIsPositionIdPending(false);
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
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-md w-full mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Portfolio:</h2>
          <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words">#1 function balanceOf(address account, uint256 GetPositionId) external view returns (uint256)
#2 CT.getPositionId(IERC20(token), getCollectionId);
#3 function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint indexSet) external view returns (bytes32)</pre>
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-md w-full mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Get CollectionId</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">ConditionID</label>
            <input
              type="text"
              value={conditionId}
              onChange={e => setConditionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171A22] text-base"
              placeholder="Enter ConditionID"
            />
          </div>
          <button
            className="bg-[#171A22] text-white px-6 py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition disabled:opacity-50"
            disabled={isCollectionIdPending || !conditionId}
            onClick={handleGetCollectionId}
          >
            {isCollectionIdPending ? "Fetching..." : "Get CollectionId"}
          </button>
          {collectionIdResult && (
            <div className="mt-2 text-sm text-gray-800 break-all">
              <strong>CollectionId:</strong> {collectionIdResult}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-md w-full mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Get PositionID</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Collateral Token</label>
            <input
              type="text"
              value={collateralToken}
              onChange={e => setCollateralToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171A22] text-base"
              placeholder="Enter Collateral Token Address"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Collection ID</label>
            <input
              type="text"
              value={collectionId}
              onChange={e => setCollectionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171A22] text-base"
              placeholder="Enter Collection ID"
            />
          </div>
          <button
            className="bg-[#171A22] text-white px-6 py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition disabled:opacity-50"
            onClick={handleGetPositionId}
            disabled={isPositionIdPending || !collateralToken || !collectionId}
          >
            {isPositionIdPending ? "Fetching..." : "Get PositionID"}
          </button>
          {positionIdResult && (
            <div className="mt-2 text-sm text-gray-800 break-all">
              <strong>PositionID:</strong> {positionIdResult}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-md w-full mt-8">
          <button
            className="bg-[#171A22] text-white px-6 py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition disabled:opacity-50 w-full"
            onClick={handleApprove}
            disabled={!account || !balance || status === "pending"}
          >
            {status === "pending" ? "Approving..." : "Approve Bets"}
          </button>
        </div>
      </div>
    </div>
  );
}