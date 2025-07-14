"use client";

import Navbar from "../../../components/Navbar";
import React, { useState, useCallback } from "react";
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
  const [conditionId] = useState("0x8555CCD72D38B0C0B6689C2AABF14F85B7F0153DD045A939E438B08BD8C33454");
  const [_parentCollectionId] = useState("0000000000000000000000000000000000000000000000000000000000000000");
  const [indexSet, setIndexSet] = useState("1");

  const [collectionIdResult, setCollectionIdResult] = useState<string | null>(null);
  const [isCollectionIdPending, setIsCollectionIdPending] = useState(false);

  // For getPositionId card
  const [_collateralToken] = useState("0x6e915a7a2940f3f3f95e65205b9ebf89df0aa141");
  const [collectionId, setCollectionId] = useState("");
  const [positionIdResult, setPositionIdResult] = useState<string | null>(null);
  const [isPositionIdPending, setIsPositionIdPending] = useState(false);

  // For balanceOf card
  const [balanceAccount, setBalanceAccount] = useState("");
  const [balancePositionId, setBalancePositionId] = useState("");
  const [balanceResult, setBalanceResult] = useState<string | null>(null);
  const [isBalancePending, setIsBalancePending] = useState(false);

  // For Your Balance card - hardcoded PositionIDs
  const [outcome1PositionId] = useState("51877916418744962899164470202259177085298509683534003885170535231097280890835");
  const [outcome2PositionId] = useState("46634212102108699492488813922022044718165605089123703573217419428873160154565");
  const [outcome1Balance, setOutcome1Balance] = useState<string>("--");
  const [outcome2Balance, setOutcome2Balance] = useState<string>("--");

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

  // New LmLSMR approval function using setApprovalForAll
  const handleLmLSMRApproval = () => {
    if (!account) return;
    const transaction = prepareContractCall({
      contract: conditionalTokensContract,
      method: "function setApprovalForAll(address operator, bool approved)",
      params: [LmLSMR_CONTRACT_ADDRESS, true],
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
    const formattedParentCollectionId = ensureHexPrefix(_parentCollectionId);
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
      const collectionIdResult = result as string;
      setCollectionIdResult(collectionIdResult);
      
      // Automatically set the collectionId for the Get PositionID function
      setCollectionId(collectionIdResult);
      
      // Automatically call Get PositionID
      setTimeout(() => {
        handleGetPositionId();
      }, 100);
      
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
      collateralToken: _collateralToken,
      collectionId: formattedCollectionId
    });
    
    try {
      const result = await readContract({
        contract: conditionalTokensContract,
        method: "function getPositionId(address collateralToken, bytes32 collectionId) pure returns (uint256)",
        params: [
          _collateralToken as `0x${string}`,
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

  const handleGetBalance = async () => {
    setIsBalancePending(true);
    
    console.log('GetBalance called with params:', {
      account: balanceAccount,
      positionId: balancePositionId
    });
    
    try {
      const result = await readContract({
        contract: conditionalTokensContract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [
          balanceAccount as `0x${string}`,
          BigInt(balancePositionId)
        ],
      });
      setBalanceResult(result.toString());
    } catch (err) {
      console.error("Balance Error details:", err);
      setBalanceResult("Error fetching Balance");
    }
    setIsBalancePending(false);
  };

  const fetchUserBalances = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      // Fetch balance for Outcome 1 (Yes)
      const balance1 = await readContract({
        contract: conditionalTokensContract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [
          account.address as `0x${string}`,
          BigInt(outcome1PositionId)
        ],
      });
      
      // Fetch balance for Outcome 2 (No)
      const balance2 = await readContract({
        contract: conditionalTokensContract,
        method: "function balanceOf(address account, uint256 id) view returns (uint256)",
        params: [
          account.address as `0x${string}`,
          BigInt(outcome2PositionId)
        ],
      });
      
      // Convert balances to strings and format them
      const balance1Str = balance1.toString();
      const balance2Str = balance2.toString();
      
      // Convert to real token amounts by dividing by 10^18
      const realBalance1 = (Number(balance1Str) / 1e18).toFixed(4);
      const realBalance2 = (Number(balance2Str) / 1e18).toFixed(4);
      
      setOutcome1Balance(realBalance1);
      setOutcome2Balance(realBalance2);
      
    } catch (err) {
      console.error("Error fetching user balances:", err);
      setOutcome1Balance("Error");
      setOutcome2Balance("Error");
    }
  }, [account?.address, outcome1PositionId, outcome2PositionId]);

  // Fetch balances when account changes or component mounts
  React.useEffect(() => {
    if (account?.address) {
      fetchUserBalances();
    }
  }, [account?.address, fetchUserBalances]);

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Index Set</label>
            <input
              type="number"
              min="0"
              value={indexSet}
              onChange={e => setIndexSet(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171A22] text-base"
              placeholder="Enter Index Set (e.g., 1 for Yes, 2 for No)"
            />
          </div>
          <button
            className="bg-[#171A22] text-white px-6 py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition disabled:opacity-50"
            disabled={isCollectionIdPending || !indexSet}
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
            disabled={isPositionIdPending || !collectionId}
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">balanceOf</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <input
              type="text"
              value={balanceAccount}
              onChange={e => setBalanceAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171A22] text-base"
              placeholder="Enter Account Address"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Position ID</label>
            <input
              type="text"
              value={balancePositionId}
              onChange={e => setBalancePositionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171A22] text-base"
              placeholder="Enter Position ID"
            />
          </div>
          <button
            className="bg-[#171A22] text-white px-6 py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition disabled:opacity-50"
            onClick={handleGetBalance}
            disabled={isBalancePending || !balanceAccount || !balancePositionId}
          >
            {isBalancePending ? "Fetching..." : "Get Balance"}
          </button>
          {balanceResult && (
            <div className="mt-2 text-sm text-gray-800 break-all">
              <strong>Balance:</strong> {balanceResult}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-md w-full mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Balance</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600 mb-2">Outcome 1 (Yes)</div>
              <div className="text-2xl font-bold text-gray-800">{outcome1Balance}</div>
              <div className="text-xs text-gray-500">Balance</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600 mb-2">Outcome 2 (No)</div>
              <div className="text-2xl font-bold text-gray-800">{outcome2Balance}</div>
              <div className="text-xs text-gray-500">Balance</div>
            </div>
          </div>
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
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 max-w-md w-full mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">LmLSMR Token Approval</h2>
          <p className="text-sm text-gray-600 mb-4">Approve the LmLSMR contract to sell your outcome tokens</p>
          <button
            className="bg-[#171A22] text-white px-6 py-2 rounded-lg font-medium text-base shadow hover:bg-[#232635] transition disabled:opacity-50 w-full"
            onClick={handleLmLSMRApproval}
            disabled={!account || status === "pending"}
          >
            {status === "pending" ? "Approving..." : "Approve LmLSMR"}
          </button>
        </div>
      </div>
      <div className="w-full h-8 bg-[#f8f9fa]"></div>
    </div>
  );
}