"use client";

import Navbar from "../../../../components/Navbar";
import React, { useState, useEffect, useCallback, use } from "react";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { getContractsForMarket, tokenContract } from "../../../../constants/contracts";
import { Tab } from "@headlessui/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import EvidenceComments from '../../../components/EvidenceComments';
import { formatOddsToCents } from "../../../utils/formatOdds";
import { submitTrade } from "../../../utils/tradeApi";
import { getMarketById } from "../../../data/markets";
import { notFound } from "next/navigation";

// Backend API base URL - use Next.js API routes for both dev and production
const API_BASE_URL = '';

// Helper to extract domain from URL
function getDomain(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Define Evidence type
interface Evidence {
  id: number;
  type: 'yes' | 'no';
  title: string;
  url?: string;
  description: string;
  netVotes: number;
  walletAddress: string;
  createdAt?: string;
  commentCount?: number;
}

// Add OddsHistoryEntry type
interface OddsHistoryEntry {
  id: number;
  yesProbability: number;
  noProbability: number;
  timestamp: string;
}

export default function MarketPage({ params }: { params: Promise<{ marketId: string }> }) {
  const resolvedParams = use(params);
  console.log('Resolved params:', resolvedParams);
  const market = getMarketById(resolvedParams.marketId);
  console.log('Found market:', market);
  
  // If market doesn't exist, show 404
  if (!market) {
    console.error('Market not found for ID:', resolvedParams.marketId);
    notFound();
  }

  const account = useActiveAccount();

  // Get contracts and position IDs based on market ID
  const { marketContract, conditionalTokensContract, outcome1PositionId, outcome2PositionId } = getContractsForMarket(market.id);

  // For Your Balance card - use market-specific PositionIDs
  const [outcome1Balance, setOutcome1Balance] = useState<string>("--");
  const [outcome2Balance, setOutcome2Balance] = useState<string>("--");
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  // Odds for Yes (0) and No (1) - with polling for real-time updates
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

  const [showRules, setShowRules] = useState(false);
  const rulesShort = market.rules;
  const rulesFull = market.rules;

  // Get only the first sentence for the collapsed view
  const firstLine = rulesShort.split(".")[0] + ".";

  // Split rules into two paragraphs at "Otherwise, the market will resolve 'No.'"
  function splitRules(text: string) {
    const splitStr = "35th President's assassination.";
    const idx = text.indexOf(splitStr);
    if (idx === -1) return [text];
    return [
      text.slice(0, idx + splitStr.length),
      text.slice(idx + splitStr.length).trim()
    ];
  }

  // Replace individual yesMode and noMode with a single mode state
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');

  // Replace individual yesAmount and noAmount with a single amount state
  const [amount, setAmount] = useState("");

  const [buyFeedback, setBuyFeedback] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showWalletError, setShowWalletError] = useState(false);

  // For Buy Yes
  const { mutate: sendBuyYesTransaction, status: buyYesStatus } = useSendTransaction();
  // For Buy No
  const { mutate: sendBuyNoTransaction, status: buyNoStatus } = useSendTransaction();

  const yesIndex = BigInt(0);
  const noIndex = BigInt(1);

  // For allowance check
  const { data: allowance, isPending: isAllowancePending, refetch: refetchAllowance } = useReadContract({
    contract: tokenContract,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: [account?.address || "", marketContract.address || ""],
  });
  const { mutate: sendApproveTransaction } = useSendTransaction();

  // Get user's ERC20 token balance (cash)
  const { data: userTokenBalance } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address owner) view returns (uint256)",
    params: [account?.address || ""],
  });

  // Convert to 64x64 fixed point
  const userDeposit = userTokenBalance ? BigInt(userTokenBalance) * BigInt(2 ** 64) : 0n;

  const handleApproveIfNeeded = async () => {
    if (isAllowancePending || !account?.address) return false;
    if (!allowance || BigInt(allowance) < userDeposit) {
      const transaction = prepareContractCall({
        contract: tokenContract,
        method: "function approve(address spender, uint256 value) returns (bool)",
        params: [marketContract.address, userDeposit],
      });
      let approved = false;
      await new Promise((resolve) => {
        sendApproveTransaction(transaction, {
          onSuccess: async () => {
            // Wait 4 seconds after approval
            await new Promise((r) => setTimeout(r, 4000));
            refetchAllowance();
            approved = true;
            resolve(true);
          },
          onError: () => resolve(false),
        });
      });
      return approved;
    }
    return false;
  };

  // Wrap the buy handler to check approval first
  const handleWalletCheck = () => {
    if (!account?.address) {
      setShowWalletError(true);
      setTimeout(() => setShowWalletError(false), 10000);
      return false;
    }
    return true;
  };

  const handleBuyYesWithApproval = async (amount: string) => {
    if (!handleWalletCheck()) return;
    
    setBuyFeedback("Checking approval (0/3)");
    const approved = await handleApproveIfNeeded();
    if (approved || (allowance && Number(allowance) >= userDeposit)) {
      setBuyFeedback(null);
      handleBuyYes(amount);
    } else {
      setBuyFeedback("Approval failed or not completed.");
    }
  };

  // Buy/Sell handlers
  const handleBuyYes = (amount: string) => {
    if (!amount || !account?.address) return;
    
    setBuyFeedback("Preparing transaction (1/3)");
    
    // For buy functions, input is USD amount, but smart contract expects shares
    // We need to convert USD to shares using the current price
    const usdAmount = parseFloat(amount);
    
    // Calculate how many shares the USD amount buys using priceResult
    if (priceResult !== undefined && !isPricePending && !priceError) {
      const totalCost = Number(priceResult) / Math.pow(2, 64);
      const pricePerShare = totalCost / usdAmount;
      const sharesToBuy = usdAmount / pricePerShare;
      
      // Validate the calculation
      if (isNaN(sharesToBuy) || sharesToBuy <= 0) {
        console.error("Invalid shares calculation:", {
          usdAmount,
          totalCost,
          pricePerShare,
          sharesToBuy
        });
        setBuyFeedback("Invalid price calculation. Please try again.");
        setTimeout(() => setBuyFeedback(null), 3000);
        return;
      }
      
      console.log('Buy calculation:', {
        usdInput: `$${usdAmount}`,
        totalCost: `$${totalCost.toFixed(2)}`,
        pricePerShare: `$${pricePerShare.toFixed(4)}`,
        sharesToBuy: `${sharesToBuy.toFixed(2)} shares`
      });
      
      // Convert shares to the format expected by the smart contract
      const parsedAmount = BigInt(Math.floor(sharesToBuy * Math.pow(2, 64)));
      
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function buy(uint256 _outcome, int128 _amount) returns (int128 _price)",
      params: [yesIndex, parsedAmount],
    });
      
    sendBuyYesTransaction(transaction, {
      onError: (error) => {
          console.error("=== BUY YES TRANSACTION ERROR ===");
          console.error("Error object:", error);
          console.error("Error type:", typeof error);
          console.error("Error message:", error?.message);
          console.error("Error name:", error?.name);
          console.error("Error stack:", error?.stack);
          console.error("Error properties:", Object.getOwnPropertyNames(error || {}));
          console.error("Transaction details:", transaction);
          console.error("USD amount:", usdAmount);
          console.error("Shares to buy:", sharesToBuy);
          console.error("Parsed amount:", parsedAmount.toString());
          console.error("Price result:", priceResult?.toString());
          console.error("Is price pending:", isPricePending);
          console.error("Price error:", priceError);
          console.error("==================================");
          
          let errorMessage = "Purchase failed. Please try again.";
          if (error?.message) {
            const msg = error.message.toLowerCase();
            if (msg.includes("insufficient funds")) {
              errorMessage = "Insufficient funds for transaction.";
            } else if (msg.includes("user rejected") || msg.includes("user denied transaction signature")) {
              errorMessage = "User cancelled transaction";
            } else if (msg.includes("gas")) {
              errorMessage = "Gas estimation failed. Try a smaller amount.";
            } else if (msg.includes("revert")) {
              errorMessage = "Transaction reverted. Check your input.";
            } else if (msg.includes("execution reverted")) {
              errorMessage = "Contract execution failed. Check your input.";
            }
          }
          
          setBuyFeedback(errorMessage);
      },
        onSuccess: async (result) => {
          console.log("Buy Yes transaction successful:", result);
          setBuyFeedback("Transaction submitted (2/3)");
        setAmount("");
          
                // Submit trade to database
      try {
        const tradeData = {
          walletAddress: account?.address || '',
          marketTitle: market.title,
          marketId: market.id, // Use the market ID string directly
          outcome: "Yes",
          shares: sharesToBuy,
          avgPrice: pricePerShare,
          betAmount: usdAmount,
          toWin: usdAmount * (1 / pricePerShare - 1), // Calculate potential winnings
          status: "OPEN"
        };
        
        const tradeResult = await submitTrade(tradeData);
        if (tradeResult) {
          console.log("Trade submitted to database successfully");
        } else {
          console.log("Trade submitted to database (no response)");
        }
      } catch (error) {
        console.error("Failed to submit trade to database:", error);
        // Don't show error to user since the blockchain transaction was successful
      }
          
          // Wait for transaction confirmation and update balances
          await waitForTransactionConfirmation(result, "Purchase Successful! (3/3)");
          
          // Record odds in the background (don't wait for it)
          recordNewOdds();
      },
      onSettled: () => {
          setTimeout(() => {
            setBuyFeedback(null);
            setSuccessMessage(null);
          }, 10000);
      }
    });
    } else {
      // Fallback if priceResult is not available
      console.error("Price result not available for buy calculation");
      setBuyFeedback("Unable to calculate price. Please try again.");
      setTimeout(() => setBuyFeedback(null), 3000);
    }
  };

  const handleBuyNo = (amount: string) => {
    if (!amount || !account?.address) return;
    
    setBuyFeedback("Preparing transaction (1/3)");
    
    // For buy functions, input is USD amount, but smart contract expects shares
    // We need to convert USD to shares using the current price
    const usdAmount = parseFloat(amount);
    
    // Calculate how many shares the USD amount buys using priceResult
    if (priceResult !== undefined && !isPricePending && !priceError) {
      const totalCost = Number(priceResult) / Math.pow(2, 64);
      const pricePerShare = totalCost / usdAmount;
      const sharesToBuy = usdAmount / pricePerShare;
      
      // Validate the calculation
      if (isNaN(sharesToBuy) || sharesToBuy <= 0) {
        console.error("Invalid shares calculation:", {
          usdAmount,
          totalCost,
          pricePerShare,
          sharesToBuy
        });
        setBuyFeedback("Invalid price calculation. Please try again.");
        setTimeout(() => setBuyFeedback(null), 3000);
        return;
      }
      
      console.log('Buy calculation:', {
        usdInput: `$${usdAmount}`,
        totalCost: `$${totalCost.toFixed(2)}`,
        pricePerShare: `$${pricePerShare.toFixed(4)}`,
        sharesToBuy: `${sharesToBuy.toFixed(2)} shares`
      });
      
      // Convert shares to the format expected by the smart contract
      const parsedAmount = BigInt(Math.floor(sharesToBuy * Math.pow(2, 64)));
      
      console.log('Transaction preparation:', {
        outcome: 'No',
        sharesToBuy,
        parsedAmount: parsedAmount.toString(),
        noIndex
      });
      
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function buy(uint256 _outcome, int128 _amount) returns (int128 _price)",
      params: [noIndex, parsedAmount],
    });

    sendBuyNoTransaction(transaction, {
      onError: (error) => {
          console.error("=== BUY NO TRANSACTION ERROR ===");
          console.error("Error object:", error);
          console.error("Error type:", typeof error);
          console.error("Error message:", error?.message);
          console.error("Error name:", error?.name);
          console.error("Error stack:", error?.stack);
          console.error("Error properties:", Object.getOwnPropertyNames(error || {}));
          console.error("Transaction details:", transaction);
          console.error("USD amount:", usdAmount);
          console.error("Shares to buy:", sharesToBuy);
          console.error("Parsed amount:", parsedAmount.toString());
          console.error("Price result:", priceResult?.toString());
          console.error("Is price pending:", isPricePending);
          console.error("Price error:", priceError);
          console.error("==================================");
          
          let errorMessage = "Purchase failed. Please try again.";
          if (error?.message) {
            const msg = error.message.toLowerCase();
            if (msg.includes("insufficient funds")) {
              errorMessage = "Insufficient funds for transaction.";
            } else if (msg.includes("user rejected") || msg.includes("user denied transaction signature")) {
              errorMessage = "User cancelled transaction";
            } else if (msg.includes("gas")) {
              errorMessage = "Gas estimation failed. Try a smaller amount.";
            } else if (msg.includes("revert")) {
              errorMessage = "Transaction reverted. Check your input.";
            } else if (msg.includes("execution reverted")) {
              errorMessage = "Contract execution failed. Check your input.";
            }
          }
          
          setBuyFeedback(errorMessage);
      },
              onSuccess: async (result) => {
        console.log("Buy No transaction successful:", result);
        setBuyFeedback("Transaction submitted (2/3)");
        setAmount("");
          
          // Submit trade to database
          try {
            const tradeData = {
              walletAddress: account?.address || '',
              marketTitle: market.title,
              marketId: market.id, // Use the market ID string directly
              outcome: "No",
              shares: sharesToBuy,
              avgPrice: pricePerShare,
              betAmount: usdAmount,
              toWin: usdAmount * (1 / pricePerShare - 1), // Calculate potential winnings
              status: "OPEN"
            };
            
                    const tradeResult = await submitTrade(tradeData);
        if (tradeResult) {
          console.log("Trade submitted to database successfully");
        } else {
          console.log("Trade submitted to database (no response)");
        }
          } catch (error) {
            console.error("Failed to submit trade to database:", error);
            // Don't show error to user since the blockchain transaction was successful
          }
          
          // Wait for transaction confirmation and update balances
          await waitForTransactionConfirmation(result, "Purchase Successful! (3/3)");
          
          // Record odds in the background (don't wait for it)
          recordNewOdds();
      },
      onSettled: () => {
          setTimeout(() => {
            setBuyFeedback(null);
            setSuccessMessage(null);
          }, 10000);
      }
    });
    } else {
      // Fallback if priceResult is not available
      console.error("Price result not available for buy calculation");
      setBuyFeedback("Unable to calculate price. Please try again.");
      setTimeout(() => setBuyFeedback(null), 3000);
    }
  };

  const handleBuyNoWithApproval = async (amount: string) => {
    if (!handleWalletCheck()) return;
    
    setBuyFeedback("Checking approval (0/3)");
    const approved = await handleApproveIfNeeded();
    if (approved || (allowance && Number(allowance) >= userDeposit)) {
      setBuyFeedback(null);
      handleBuyNo(amount);
    } else {
      setBuyFeedback("Approval failed or not completed.");
    }
  };

  // For Sell Yes
  const { mutate: sendSellYesTransaction } = useSendTransaction();
  // For Sell No
  const { mutate: sendSellNoTransaction } = useSendTransaction();

  // Note: Buy functions convert USD input to shares using priceResult
  // Sell functions expect share input directly (no conversion needed)
  const handleSellYes = (amount: string) => {
    if (!amount || !account?.address) return;
    
    setBuyFeedback("Preparing transaction (1/3)");
    
    // For sell functions, input is number of shares, not USD
    const shareAmount = parseFloat(amount);
    const parsedAmount = BigInt(Math.floor(shareAmount * Math.pow(2, 64)));
    
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function sell(uint256 _outcome, int128 _amount) returns (int128 _price)",
      params: [yesIndex, parsedAmount],
    });
    
    sendSellYesTransaction(transaction, {
      onError: (error) => {
        console.error("=== SELL YES TRANSACTION ERROR ===");
        console.error("Error object:", error);
        console.error("Error message:", error.message);
        console.error("Error name:", error.name);
        console.error("Error stack:", error.stack);
        console.error("Error properties:", Object.getOwnPropertyNames(error));
        console.error("Transaction details:", transaction);
        console.error("Share amount:", shareAmount);
        console.error("Parsed amount:", parsedAmount.toString());
        console.error("==================================");
        
        let errorMessage = "Sale failed. Please try again.";
        
        // More detailed error analysis
        if (error.message) {
          const msg = error.message.toLowerCase();
          if (msg.includes("insufficient funds")) {
            errorMessage = "Insufficient shares to sell.";
          } else if (msg.includes("user rejected") || msg.includes("user denied transaction signature")) {
            errorMessage = "User cancelled transaction";
          } else if (msg.includes("gas")) {
            errorMessage = "Gas estimation failed. Try a smaller amount.";
          } else if (msg.includes("revert")) {
            errorMessage = "Transaction reverted. Check your shares balance.";
          } else if (msg.includes("nonce")) {
            errorMessage = "Transaction nonce error. Try refreshing the page.";
          } else if (msg.includes("execution reverted")) {
            errorMessage = "Contract execution failed. Insufficient shares or invalid amount.";
          } else if (msg.includes("out of gas")) {
            errorMessage = "Transaction ran out of gas. Try a smaller amount.";
          } else if (msg.includes("already known")) {
            errorMessage = "Transaction already submitted. Check your wallet.";
          } else if (msg.includes("0xe237d922")) {
            errorMessage = "Contract error: Insufficient shares or invalid sell amount. Check your balance.";
          } else if (msg.includes("abi error signature not found")) {
            errorMessage = "Contract error: Invalid sell request. Check your shares balance and try a smaller amount.";
          }
        }
        
        setBuyFeedback(errorMessage);
      },
      onSuccess: async (result) => {
        console.log("Sell Yes transaction successful:", result);
        setBuyFeedback("Transaction submitted (2/3)");
        setAmount("");
        
        // Wait for transaction confirmation and update balances
        await waitForTransactionConfirmation(result, "Sale Successful! (3/3)");
        
        // Record odds in the background (don't wait for it)
        recordNewOdds();
      },
      onSettled: () => {
        setTimeout(() => {
          setBuyFeedback(null);
          setSuccessMessage(null);
        }, 10000);
      }
    });
  };

  const handleSellNo = (amount: string) => {
    if (!amount || !account?.address) return;
    
    setBuyFeedback("Preparing transaction (1/3)");
    
    // For sell functions, input is number of shares, not USD
    const shareAmount = parseFloat(amount);
    const parsedAmount = BigInt(Math.floor(shareAmount * Math.pow(2, 64)));
    
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function sell(uint256 _outcome, int128 _amount) returns (int128 refund)",
      params: [noIndex, parsedAmount],
    });
    
    sendSellNoTransaction(transaction, {
      onError: (error) => {
        console.error("Sell No transaction error:", {
          error,
          message: error.message,
          transaction: transaction,
          shareAmount,
          parsedAmount: parsedAmount.toString()
        });
        
        let errorMessage = "Sale failed. Please try again.";
        if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient shares to sell.";
        } else if (error.message.includes("user rejected") || error.message.includes("user denied transaction signature")) {
          errorMessage = "User cancelled transaction";
        } else if (error.message.includes("gas")) {
          errorMessage = "Gas estimation failed. Try a smaller amount.";
        }
        
        setBuyFeedback(errorMessage);
      },
      onSuccess: async (result) => {
        console.log("Sell No transaction successful:", result);
        setBuyFeedback("Transaction submitted (2/3)");
        setAmount("");
        
        // Wait for transaction confirmation and update balances
        await waitForTransactionConfirmation(result, "Sale Successful! (3/3)");
        
        // Record odds in the background (don't wait for it)
        recordNewOdds();
      },
      onSettled: () => {
        setTimeout(() => {
          setBuyFeedback(null);
          setSuccessMessage(null);
        }, 10000);
      }
    });
  };

  // Evidence state
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [votingEvidenceId, setVotingEvidenceId] = useState<number | null>(null);
  const [userVotes, setUserVotes] = useState<Set<number>>(new Set());
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<number | null>(null);
  const [showAllYes, setShowAllYes] = useState(false);
  const [showAllNo, setShowAllNo] = useState(false);
  
  // Trading state
  const [selectedOutcome, setSelectedOutcome] = useState<'yes' | 'no' | null>(null);
  const [priceResult, setPriceResult] = useState<bigint | undefined>(undefined);
  const [isPricePending, setIsPricePending] = useState(false);
  const [priceError, setPriceError] = useState<Error | null>(null);
  
  // Odds history state
  const [oddsHistory, setOddsHistory] = useState<OddsHistoryEntry[]>([]);
  const [loadingOdds, setLoadingOdds] = useState(true);
  
  // Evidence form state
  const [evidenceType, setEvidenceType] = useState<'yes' | 'no'>('yes');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  // Add state for evidence submission success message
  const [evidenceSuccessMessage, setEvidenceSuccessMessage] = useState<string | null>(null);

  // Handle automatic price calculation
  const handleAutoGetPrice = useCallback(async (outcome: number, amount: number) => {
    setIsPricePending(true);
    setPriceError(null);
    setPriceResult(undefined);
    try {
      const result = await readContract({
        contract: marketContract,
        method: "function price(uint256 _outcome, int128 _amount) view returns (int128)",
        params: [BigInt(outcome), BigInt(Math.floor(amount * Math.pow(2, 64)))],
      });
      setPriceResult(result);
      console.log('Auto price result:', {
        rawResult: result.toString(),
        formattedPrice: `$${(Number(result) / Math.pow(2, 64)).toFixed(2)}`,
        pricePerShare: `$${((Number(result) / Math.pow(2, 64)) / amount).toFixed(2)}`,
        pricePerShareCents: `¢${(((Number(result) / Math.pow(2, 64)) / amount) * 100).toFixed(0)}`,
        outcome,
        amount
      });
    } catch (error) {
      setPriceError(error as Error);
      console.error('Auto price function error:', error);
    } finally {
      setIsPricePending(false);
    }
  }, [marketContract]);

  useEffect(() => {
    if (selectedOutcome && amount && parseFloat(amount) > 0) {
      const outcome = selectedOutcome === 'yes' ? 1 : 2;
      const amountValue = parseFloat(amount);
      if (!isNaN(amountValue) && amountValue > 0) {
        handleAutoGetPrice(outcome, amountValue);
      }
    }
  }, [selectedOutcome, amount, handleAutoGetPrice]);

  // Fetch odds history function (read-only, for page loads)
  const fetchOddsHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/odds-history?marketId=${market.id}`);
      if (!res.ok) {
        console.error('Failed to fetch odds history:', res.status, res.statusText);
        setOddsHistory([]);
        setLoadingOdds(false);
        return;
      }
      const data = await res.json();
      setOddsHistory(Array.isArray(data) ? data : []);
      setLoadingOdds(false);
    } catch (error) {
      console.error('Error fetching odds history:', error);
      setOddsHistory([]);
      setLoadingOdds(false);
    }
  }, [market.id]);

  useEffect(() => {
    fetchOddsHistory();
  }, [market.id, fetchOddsHistory]);

  // Fetch evidence on mount
  useEffect(() => {
    console.log('Fetching evidence for market:', market.id);
    fetch(`${API_BASE_URL}/api/evidence?marketId=${market.id}`)
      .then(res => {
        console.log('Evidence response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Evidence data received:', data);
        if (Array.isArray(data)) {
          setEvidence(data);
        } else {
          console.error('Evidence data is not an array:', data);
          setEvidence([]);
        }
      })
      .catch(error => {
        console.error('Error fetching evidence:', error);
        setEvidence([]);
      });
  }, [market.id]);

  // Fetch user's existing votes to sync state
  const fetchUserVotes = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/user-votes?walletAddress=${account.address}&marketId=${market.id}`);
      if (res.ok) {
        const userVoteData = await res.json();
        // Assuming the backend returns an array of evidence IDs the user has voted on
        const votedEvidenceIds: Set<number> = new Set(userVoteData.map((vote: { evidenceId: number }) => Number(vote.evidenceId)));
        setUserVotes(votedEvidenceIds);
      }
    } catch (error) {
      console.error('Failed to fetch user votes:', error);
    }
  }, [account?.address, market.id]);

  // Fetch user votes when account changes
  useEffect(() => {
    if (account?.address) {
      fetchUserVotes();
    } else {
      setUserVotes(new Set());
    }
  }, [account?.address, fetchUserVotes]);

  // Fetch user balances function (with loading state)
  const fetchUserBalances = useCallback(async () => {
    if (!account?.address) return;
    
    setIsBalanceLoading(true);
    
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
      
      // Convert to real token amounts by dividing by 10^18 and remove decimals
      const yesShares = Math.floor(Number(balance1Str) / 1e18).toString();
      const noShares = Math.floor(Number(balance2Str) / 1e18).toString();
      
      console.log('Initial balance fetch:', { yesShares, noShares });
      
      setOutcome1Balance(yesShares);
      setOutcome2Balance(noShares);
      
    } catch (err) {
      console.error("Error fetching user balances:", err);
      setOutcome1Balance("Error");
      setOutcome2Balance("Error");
    } finally {
    setIsBalanceLoading(false);
    }
  }, [account?.address, outcome1PositionId, outcome2PositionId, conditionalTokensContract]);

  // Track last call time to prevent excessive API calls
  const lastCallTime = React.useRef<number>(0);

  // Fetch user balances without showing loading state (for polling)
  const fetchUserBalancesWithoutLoading = useCallback(async () => {
    if (!account?.address) return;
    
    // Add a simple debounce to prevent excessive calls
    const currentTime = Date.now();
    if (lastCallTime.current && currentTime - lastCallTime.current < 5000) {
      return; // Don't call if last call was less than 5 seconds ago
    }
    lastCallTime.current = currentTime;
    
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
      
      // Convert to real token amounts by dividing by 10^18 and remove decimals
      const yesShares = Math.floor(Number(balance1Str) / 1e18).toString();
      const noShares = Math.floor(Number(balance2Str) / 1e18).toString();
      
      // Only update state if values actually changed to prevent blinking
      setOutcome1Balance(prev => prev !== yesShares ? yesShares : prev);
      setOutcome2Balance(prev => prev !== noShares ? noShares : prev);
      
    } catch (err) {
      // Only log errors if wallet is still connected (to avoid spam when disconnecting)
      if (account?.address) {
      console.error("Error fetching user balances:", err);
      }
      // Don't set error state during polling to prevent blinking
    }
  }, [account?.address, outcome1PositionId, outcome2PositionId, conditionalTokensContract]);

  // Polling mechanism for user balances
  useEffect(() => {
    if (!account?.address) {
      // Reset balances when no wallet is connected
      setOutcome1Balance("--");
      setOutcome2Balance("--");
      setIsBalanceLoading(false);
      return;
    }

    // Initial fetch with loading state
    fetchUserBalances();

    // Set up polling interval (check every 30 seconds) without loading state
    const interval = setInterval(() => {
      // Don't set loading state during polling to prevent blinking
      fetchUserBalancesWithoutLoading();
    }, 30000);

    // Cleanup interval on unmount or account change
    return () => clearInterval(interval);
  }, [account?.address, fetchUserBalances, fetchUserBalancesWithoutLoading]);

  // Handle submit document
  const handleSubmitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !url.trim()) return;
    const newEvidence = {
      marketId: market.id,
      type: evidenceType,
      title: title.trim(),
      url: url.trim(),
      description: '', // No description field anymore
      walletAddress: account?.address || '',
    };
    const res = await fetch(`${API_BASE_URL}/api/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvidence),
    });
    const created = await res.json();
    setEvidence(prev => [created, ...prev]);
    setTitle('');
    setUrl('');
    setEvidenceType('yes');
    setEvidenceSuccessMessage('Evidence Successfully Submitted!');
    setTimeout(() => setEvidenceSuccessMessage(null), 10000);
  };

  // Handle upvote/downvote toggle
  const handleVote = async (id: number, evidenceType: 'yes' | 'no') => {
    if (!account?.address) return;
    
    // Update user position before voting
    await fetch('/api/update-user-position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId: market.id,
        walletAddress: account.address,
        yesShares: parseInt(outcome1Balance) || 0,
        noShares: parseInt(outcome2Balance) || 0,
      }),
    });
    
    // Set loading state for this specific evidence
    setVotingEvidenceId(id);
    
    // Check if user has already voted on this evidence
    const hasVoted = userVotes.has(id);
    
    // Always send 'upvote' to backend - backend will handle toggle logic
    const voteType = 'upvote';
    
    // Calculate the user's full voting weight for this evidence type
    const yesShares = parseInt(outcome1Balance) || 0;
    const noShares = parseInt(outcome2Balance) || 0;
    
    let votingWeight = 1;
    if (evidenceType === 'yes' && yesShares > noShares) {
      votingWeight = Math.max(1, yesShares - noShares);
    } else if (evidenceType === 'no' && noShares > yesShares) {
      votingWeight = Math.max(1, noShares - yesShares);
    }
    
    console.log('Voting weight calculation:', {
      evidenceType,
      yesShares,
      noShares,
      votingWeight,
      outcome1Balance,
      outcome2Balance
    });
    
    // Optimistic update - immediately update the UI
    const optimisticEvidence = evidence.map(ev => {
      if (ev.id === id) {
        return {
          ...ev,
          netVotes: hasVoted 
            ? ev.netVotes - votingWeight  // Remove vote
            : ev.netVotes + votingWeight  // Add vote
        };
      }
      return ev;
    });
    
    // Update UI immediately
    setEvidence(optimisticEvidence);
    
    // Update user votes tracking optimistically
    if (hasVoted) {
      setUserVotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    } else {
      setUserVotes(prev => new Set(prev).add(id));
    }
    
    try {
      const voteData = { 
        evidenceId: id, 
        walletAddress: account.address,
        voteType: voteType,
        evidenceType: evidenceType,
        marketId: market.id
      };
      
      console.log('Sending vote to backend:', voteData);
      
      const res = await fetch(`${API_BASE_URL}/api/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData),
      });
      
      if (res.ok) {
        // Get the updated evidence with accurate vote counts
        const evidenceRes = await fetch(`${API_BASE_URL}/api/evidence?marketId=${market.id}`);
        const updatedEvidence = await evidenceRes.json();
        setEvidence(updatedEvidence);
        
        // Refresh user votes to get accurate state
        await fetchUserVotes();
      } else {
        // Revert optimistic update on error
        setEvidence(evidence);
        // Revert user votes tracking
        if (hasVoted) {
          setUserVotes(prev => new Set(prev).add(id));
        } else {
          setUserVotes(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }
        
        // Better error handling
        let errorMessage = 'Vote failed';
        try {
          const errorData = await res.json();
          console.error('Vote failed:', {
            status: res.status,
            statusText: res.statusText,
            error: errorData,
            evidenceId: id,
            voteType: voteType,
            evidenceType: evidenceType,
            walletAddress: account.address
          });
          
          errorMessage = errorData.error || errorData.message || 'Vote failed';
        } catch (parseError) {
          console.error('Vote failed - could not parse error response:', {
            status: res.status,
            statusText: res.statusText,
            parseError
          });
        }
        
        // Show error to user (you could add a toast notification here)
        console.error(errorMessage);
      }
    } catch (error) {
      // Revert optimistic update on error
      setEvidence(evidence);
      // Revert user votes tracking
      if (hasVoted) {
        setUserVotes(prev => new Set(prev).add(id));
      } else {
        setUserVotes(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
      console.error('Vote error:', error);
    } finally {
      // Clear loading state
      setVotingEvidenceId(null);
    }
  };

  // Filter and sort evidence for Yes/No tabs
  const sortedYesEvidence = (Array.isArray(evidence) ? evidence : []).filter(ev => ev.type === 'yes').sort((a, b) => b.netVotes - a.netVotes);
  const sortedNoEvidence = (Array.isArray(evidence) ? evidence : []).filter(ev => ev.type === 'no').sort((a, b) => b.netVotes - a.netVotes);

  // Show limited evidence initially
  const yesToShow = showAllYes ? sortedYesEvidence : sortedYesEvidence.slice(0, 5);

  // Get user's voting contribution for a specific evidence
  const getUserVotingContribution = (evidenceId: number, evidenceType: 'yes' | 'no') => {
    if (!userVotes.has(evidenceId)) return 0;
    
    const yesShares = parseInt(outcome1Balance) || 0;
    const noShares = parseInt(outcome2Balance) || 0;
    
    if (evidenceType === 'yes' && yesShares > noShares) {
      return Math.max(1, yesShares - noShares);
    } else if (evidenceType === 'no' && noShares > yesShares) {
      return Math.max(1, noShares - yesShares);
    }
    
    return 1; // Base weight
  };

  // Prepare data for chart: group by timestamp, with yes/no as separate lines
  const ODDS_DIVISOR = Number("18446744073709551616");
  const chartData = oddsHistory
    .filter(entry =>
      typeof entry.yesProbability === "number" &&
      typeof entry.noProbability === "number"
    )
    .map(entry => ({
      timestamp: new Date(entry.timestamp).toISOString().slice(0, 10),
      Yes: entry.yesProbability / ODDS_DIVISOR,
      No: entry.noProbability / ODDS_DIVISOR,
    }));

  // Calculate payout based on actual price from priceResult
  let payoutDisplay = '--';
  let avgPriceDisplay = '--';
  if (selectedOutcome && amount && !isNaN(Number(amount)) && Number(amount) > 0) {
    if (mode === 'sell') {
      // Use live market price for sell
      const odds = selectedOutcome === 'yes' ? oddsYes : oddsNo;
      if (typeof odds === 'bigint' || typeof odds === 'number') {
        const oddsNum = Number(odds) / ODDS_DIVISOR;
        const payout = Number(amount) * oddsNum;
        if (isFinite(payout)) {
          payoutDisplay = `$${payout.toFixed(2)}`;
        }
        avgPriceDisplay = `¢${(oddsNum * 100).toFixed(0)}`;
      }
    } else if (priceResult !== undefined && !isPricePending && !priceError) {
      // Use the actual price from priceResult for more accurate calculation
      const totalCost = Number(priceResult) / Math.pow(2, 64);
      const amountNum = parseFloat(amount);
        // For buy: Input is USD amount, calculate how many shares that buys
        const pricePerShare = totalCost / amountNum;
        const sharesBought = amountNum / pricePerShare;
        const totalReturn = sharesBought; // $1 per share * number of shares
        payoutDisplay = `$${totalReturn.toFixed(2)}`;
      avgPriceDisplay = `¢${((totalCost / amountNum) * 100).toFixed(0)}`;
    } else {
      // Fallback to odds-based calculation if priceResult not available
      const odds = selectedOutcome === 'yes' ? oddsYes : oddsNo;
    if (typeof odds === 'bigint' || typeof odds === 'number') {
      const oddsNum = Number(odds) / ODDS_DIVISOR;
      let payout = 0;
      if (mode === 'buy') {
        payout = Number(amount) / oddsNum;
      } else {
        payout = Number(amount) * oddsNum;
      }
      if (isFinite(payout)) {
        payoutDisplay = `$${payout.toFixed(2)}`;
      }
        avgPriceDisplay = `¢${(oddsNum * 100).toFixed(0)}`;
      }
    }
  }

  const updateUserPosition = useCallback(async (marketId: string, walletAddress: string, yesShares: string, noShares: string) => {
    try {
      await fetch("/api/update-user-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          walletAddress,
          yesShares: parseInt(yesShares) || 0,
          noShares: parseInt(noShares) || 0,
        }),
      });

      // Refetch evidence for the current market
      const evidenceRes = await fetch(`/api/evidence?marketId=${marketId}`);
      if (evidenceRes.ok) {
        const updatedEvidence = await evidenceRes.json();
        setEvidence(updatedEvidence);
      }
    } catch (error) {
      console.error("Failed to update user position or fetch evidence:", error);
    }
  }, []);

  useEffect(() => {
    const updatePositionAndEvidence = async () => {
      if (
        account?.address &&
        outcome1Balance !== "--" &&
        outcome2Balance !== "--" &&
        !isBalanceLoading
      ) {
        // Update backend position
        await fetch("/api/update-user-position", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: market.id,
            walletAddress: account.address,
            yesShares: parseInt(outcome1Balance) || 0,
            noShares: parseInt(outcome2Balance) || 0,
          }),
        });

        // Refetch evidence for the current market
        const evidenceRes = await fetch(`/api/evidence?marketId=${market.id}`);
        if (evidenceRes.ok) {
          const updatedEvidence = await evidenceRes.json();
          setEvidence(updatedEvidence);
        }
      }
    };

    updatePositionAndEvidence();
  }, [account?.address, market.id]);

  // Wait for transaction confirmation and update balances
  const waitForTransactionConfirmation = async (transactionResult: any, successMessage: string) => {
    try {
      // Wait for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update balances immediately after confirmation
      await fetchUserBalancesWithoutLoading();
      
      // Fetch latest balances directly from contract
      let latestYesShares = 0;
      let latestNoShares = 0;
      if (account?.address) {
        try {
          const balance1 = await readContract({
            contract: conditionalTokensContract,
            method: "function balanceOf(address account, uint256 id) view returns (uint256)",
            params: [
              account.address as `0x${string}`,
              BigInt(outcome1PositionId)
            ],
          });
          const balance2 = await readContract({
            contract: conditionalTokensContract,
            method: "function balanceOf(address account, uint256 id) view returns (uint256)",
            params: [
              account.address as `0x${string}`,
              BigInt(outcome2PositionId)
            ],
          });
          latestYesShares = Math.floor(Number(balance1.toString()) / 1e18);
          latestNoShares = Math.floor(Number(balance2.toString()) / 1e18);
        } catch (err) {
          console.error("Error fetching latest balances after transaction:", err);
        }
      }
      
      // Update user position and evidence after buy/sell
      if (account?.address && market.id) {
        await fetch('/api/update-user-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId: market.id,
            walletAddress: account.address,
            yesShares: latestYesShares,
            noShares: latestNoShares,
          }),
        });
        // Refetch evidence for the current market
        const evidenceRes = await fetch(`/api/evidence?marketId=${market.id}`);
        if (evidenceRes.ok) {
          const updatedEvidence = await evidenceRes.json();
          setEvidence(updatedEvidence);
        }
      }
      
      // Show success message immediately after balance is updated
      setBuyFeedback(null);
      setSuccessMessage(successMessage);
      
      // Set up a retry mechanism to ensure balances are updated
      let retries = 0;
      const maxRetries = 5;
      
      while (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchUserBalancesWithoutLoading();
        retries++;
      }
    } catch (error) {
      console.error("Error waiting for transaction confirmation:", error);
      // Fallback to immediate balance update
      await fetchUserBalancesWithoutLoading();
      // Still show success message even if there's an error
      setBuyFeedback(null);
      setSuccessMessage(successMessage);
    }
  };

  // Calculate user's voting power for Yes and No
  const yesShares = parseInt(outcome1Balance) || 0;
  const noShares = parseInt(outcome2Balance) || 0;
  const yesVotingPower = yesShares > noShares ? Math.max(1, yesShares - noShares) : 1;
  const noVotingPower = noShares > yesShares ? Math.max(1, noShares - yesShares) : 1;

  // For conditional tokens approval (for selling)
  const { mutate: sendSetApprovalForAll, status: setApprovalStatus } = useSendTransaction();
  const { data: isOperatorApproved, refetch: refetchOperatorApproval } = useReadContract({
    contract: conditionalTokensContract,
    method: "function isApprovedForAll(address owner, address operator) view returns (bool)",
    params: [account?.address || "", marketContract.address || ""],
  });

  const handleSetApprovalForAllIfNeeded = async () => {
    if (!isOperatorApproved) {
      const transaction = prepareContractCall({
        contract: conditionalTokensContract,
        method: "function setApprovalForAll(address operator, bool approved)",
        params: [marketContract.address, true],
      });
      let approved = false;
      await new Promise((resolve) => {
        sendSetApprovalForAll(transaction, {
          onSuccess: async () => {
            // Wait 4 seconds after approval
            await new Promise((r) => setTimeout(r, 4000));
            refetchOperatorApproval();
            approved = true;
            resolve(true);
          },
          onError: () => resolve(false),
        });
      });
      return approved;
    }
    return true;
  };

  // Wrap the sell handlers to check approval first
  const handleSellYesWithApproval = async (amount: string) => {
    if (!handleWalletCheck()) return;
    
    setBuyFeedback("Checking approval (0/3)");
    const approved = await handleSetApprovalForAllIfNeeded();
    if (approved) {
      setBuyFeedback(null);
      handleSellYes(amount);
    } else {
      setBuyFeedback("Approval for selling failed or not completed.");
    }
  };
  const handleSellNoWithApproval = async (amount: string) => {
    if (!handleWalletCheck()) return;
    
    setBuyFeedback("Checking approval (0/3)");
    const approved = await handleSetApprovalForAllIfNeeded();
    if (approved) {
      setBuyFeedback(null);
      handleSellNo(amount);
    } else {
      setBuyFeedback("Approval for selling failed or not completed.");
    }
  };

  // Wrap recordNewOdds in useCallback
  const recordNewOdds = useCallback(async () => {
    try {
      // Wait a bit for the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      const currentYesOdds = await readContract({
        contract: marketContract,
        method: "function odds(uint256 _outcome) view returns (int128)",
        params: [0n],
      });
      const currentNoOdds = await readContract({
        contract: marketContract,
        method: "function odds(uint256 _outcome) view returns (int128)",
        params: [1n],
      });
      console.log('Raw odds from contract (after delay):', {
        yesOdds: currentYesOdds.toString(),
        noOdds: currentNoOdds.toString(),
        yesOddsNumber: Number(currentYesOdds),
        noOddsNumber: Number(currentNoOdds)
      });
      // Store the raw odds values (not converted to probabilities)
      const yesProbability = Number(currentYesOdds);
      const noProbability = Number(currentNoOdds);
      // Record to database (after trade, odds should have changed)
      const oddsResponse = await fetch(`${API_BASE_URL}/api/odds-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          yesProbability,
          noProbability,
          timestamp: new Date().toISOString()
        }),
      });
      if (!oddsResponse.ok) {
        console.error('Failed to record odds to database:', oddsResponse.status, oddsResponse.statusText);
      } else {
        console.log('Recorded new odds to database after trade:', { yesProbability, noProbability });
      }
      // Refresh the odds history to show the new entry
      try {
        await fetchOddsHistory();
      } catch (error) {
        console.error('Failed to refresh odds history:', error);
      }
    } catch (error) {
      console.error('Failed to record odds:', error);
    }
  }, [marketContract, market.id, fetchOddsHistory]);

  return (
    <div>
      <Navbar />
      {/* Wallet Connection Error Popup */}
      {showWalletError && (
        <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <div className="bg-white rounded-lg p-6 mx-4 shadow-lg border border-gray-200" style={{ maxWidth: '375px' }}>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Wallet Required</h3>
              <p className="text-gray-600 mb-4">Please connect a wallet to begin trading. Click connect button in the top right and sign-in using any account.</p>
              <button
                onClick={() => setShowWalletError(false)}
                className="bg-black text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center pt-8 w-full">
        {/* Responsive flex row for chart and betting card */}
        <div className="flex flex-col lg:flex-row justify-between items-start w-full max-w-7xl mx-auto mb-10 gap-2">
          {/* Odds History Chart Card */}
          <div className="bg-white rounded-xl shadow border border-gray-200 p-8 max-w-4xl w-full mb-8 lg:mb-0 ml-auto">
            <h2 className="text-2xl font-bold mb-6 text-[#171A22]">{market.title}</h2>
            <div className="mb-2">
              <span className="text-lg font-semibold text-[#171A22]">Market Odds</span>
            </div>
            {loadingOdds ? (
              <div className="text-gray-500">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 5, bottom: 0 }}>
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12, dy: 8 }}
                    height={40}
                    tickFormatter={(_, index) => {
                      if (index === 0) {
                        const [, month, day] = chartData[0].timestamp.split('-');
                        return `${month}/${day}`;
                      }
                      return "";
                    }}
                    padding={{ left: 0, right: 0 }}
                    minTickGap={0}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={v => (typeof v === 'number' ? `${Math.round(v * 100)}%` : v)}
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={v => (typeof v === 'number' ? `${Math.round(v * 100)}%` : v)} />
                  <Legend />
                  <ReferenceLine y={0.25} stroke="#bdbdbd" strokeDasharray="4 4" />
                  <ReferenceLine y={0.5} stroke="#bdbdbd" strokeDasharray="4 4" />
                  <ReferenceLine y={0.75} stroke="#bdbdbd" strokeDasharray="4 4" />
                  <ReferenceLine y={1} stroke="#bdbdbd" strokeDasharray="4 4" />
                  <Line type="linear" dataKey="Yes" stroke="#22c55e" dot={false} name="Yes Probability" />
                  <Line type="linear" dataKey="No" stroke="#ef4444" dot={false} name="No Probability" />
                </LineChart>
              </ResponsiveContainer>
            )}
            {/* Collapsible Rules section (moved inside chart card) */}
            <div className="mt-8">
              <h2 className="text-lg font-bold mb-2">Rules</h2>
              {splitRules(showRules ? rulesFull : firstLine).map((para, i) => (
                <p key={i} className="text-gray-600 text-base mb-2">{para}</p>
              ))}
              <button
                className="text-blue-600 text-sm font-medium flex items-center gap-1 focus:outline-none mb-2"
                onClick={() => setShowRules((prev) => !prev)}
              >
                {showRules ? "Read Less" : "Read More"}
                <span className={showRules ? "rotate-180" : ""}>▼</span>
              </button>
            </div>
          </div>
          {/* Betting Card */}
          <div className="bg-white rounded-xl shadow border border-gray-200 p-8 w-full" style={{ maxWidth: '300px' }}>
            {/* Buy/Sell Toggle */}
            <div className="flex items-center mb-2">
              <div className="flex gap-2">
                <button
                  className={`py-1 px-3 text-base rounded-full border ${mode === 'buy' ? 'bg-gray-100 text-green-600 border-gray-300 font-bold' : 'bg-white text-black border-gray-300 font-normal'}`}
                  onClick={() => setMode('buy')}
                  type="button"
                >
                  Buy
                </button>
                <button
                  className={`py-1 px-3 text-base rounded-full border ${mode === 'sell' ? 'bg-gray-100 text-green-600 border-gray-300 font-bold' : 'bg-white text-black border-gray-300 font-normal'}`}
                  onClick={() => setMode('sell')}
                  type="button"
                >
                  Sell
                </button>
              </div>
            </div>
            {/* Bet Amount sub-title */}
            <div className="text-[1.15rem] font-medium text-black mb-4">{mode === 'buy' ? 'Bet Amount ($)' : 'Sell Shares'}</div>
            {/* Amount input */}
            <input
              type="text"
              placeholder={`Enter ${mode === 'buy' ? 'Buy' : 'Sell'} Amount`}
              value={amount ? (mode === 'buy' ? `$${amount}` : amount) : ''}
              onChange={e => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                setAmount(value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-base mb-4"
            />
            {/* Yes/No Cent Price buttons */}
            <div className="flex flex-row w-full mb-4 gap-2">
              <button
                type="button"
                className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white w-1/2 ${selectedOutcome === 'yes' ? 'ring-2 ring-black' : ''}`}
                onClick={() => setSelectedOutcome('yes')}
              >
                {mode === 'buy'
                  ? (buyYesStatus === 'pending' ? 'Buying...' : `Yes ${formatOddsToCents(oddsYes)}`)
                  : (buyYesStatus === 'pending' ? 'Selling...' : `Yes ${formatOddsToCents(oddsYes)}`)}
              </button>
              <button
                type="button"
                className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-red-600 hover:bg-red-700 text-white w-1/2 ${selectedOutcome === 'no' ? 'ring-2 ring-black' : ''}`}
                onClick={() => setSelectedOutcome('no')}
              >
                {mode === 'buy'
                  ? (buyNoStatus === 'pending' ? 'Buying...' : `No ${formatOddsToCents(oddsNo)}`)
                  : (buyNoStatus === 'pending' ? 'Selling...' : `No ${formatOddsToCents(oddsNo)}`)}
              </button>
            </div>
            {/* Max. Win/Receive sub-title */}
            <div className="text-[1.15rem] font-medium text-black">{mode === 'buy' ? 'Max. Win:' : 'Receive:'} <span className="text-green-600 font-bold">{payoutDisplay}</span></div>
            {/* Avg. Price display */}
            <div className="text-left text-sm text-gray-600 mb-4">
              Avg. Price
              {avgPriceDisplay !== '--' && (
                <span className="ml-2 text-sm text-gray-600">{avgPriceDisplay}</span>
              )}
            </div>
            {/* Trade button */}
            <button
              className="w-full font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-black text-white mb-4"
              disabled={!selectedOutcome || !amount || (selectedOutcome === 'yes' && (mode === 'buy' ? buyYesStatus === 'pending' : buyYesStatus === 'pending')) || (selectedOutcome === 'no' && (mode === 'buy' ? buyNoStatus === 'pending' : buyNoStatus === 'pending'))}
              onClick={() => {
                if (!selectedOutcome || !amount) return;
                if (selectedOutcome === 'yes') {
                  if (mode === 'buy') { handleBuyYesWithApproval(amount); } else { handleSellYesWithApproval(amount); }
                } else if (selectedOutcome === 'no') {
                  if (mode === 'buy') { handleBuyNoWithApproval(amount); } else { handleSellNoWithApproval(amount); }
                }
              }}
            >
              Submit Trade
            </button>
            {/* Your Balance Section */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Your Purchased Shares</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm font-semibold text-green-600 mb-1">Yes Shares</div>
                  <div className="text-lg font-bold text-gray-800">{isBalanceLoading ? "..." : outcome1Balance}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-red-600 mb-1">No Shares</div>
                  <div className="text-lg font-bold text-gray-800">{isBalanceLoading ? "..." : outcome2Balance}</div>
                </div>
              </div>
            </div>
            {/* Transaction feedback moved below Your Purchased Shares */}
            {buyFeedback && (
              <div className={`text-center mt-4 font-semibold flex items-center justify-center gap-1 ${
                buyFeedback.includes('Purchase Successful') || buyFeedback.includes('Sale Successful') || buyFeedback.includes('🎉')
                  ? 'text-green-600' 
                  : buyFeedback.includes('Preparing transaction') || buyFeedback.includes('Checking approval') || buyFeedback.includes('Transaction submitted')
                    ? 'text-black' 
                    : 'text-red-600'
              }`}>
                {(buyFeedback.includes('Preparing transaction') || buyFeedback.includes('Checking approval') || buyFeedback.includes('Transaction submitted')) && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black flex-shrink-0"></div>
                )}
                {(buyFeedback.includes('Purchase Successful') || buyFeedback.includes('Sale Successful') || buyFeedback.includes('🎉')) && (
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="whitespace-nowrap">{buyFeedback}</span>
              </div>
            )}
            {/* Success message after balance update */}
            {successMessage && (
              <div className="text-center mt-4 text-green-600 font-semibold flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {successMessage}
              </div>
            )}
          </div>
        </div>
        {/* Evidence Section Card */}
        <div className="max-w-7xl w-full mx-auto flex">
          <div className="bg-white rounded-xl shadow border border-gray-200 p-8 max-w-4xl w-full ml-19">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#171A22]">Evidence</h2>
              {/* Voting Power Display */}
              <div className="flex items-center space-x-2 text-xs font-medium">
                <span className="text-green-600 font-semibold">Yes Power: {yesVotingPower}x</span>
                <span className="text-gray-400">|</span>
                <span className="text-red-600 font-semibold">No Power: {noVotingPower}x</span>
              </div>
            </div>
            <Tab.Group>
              <Tab.List className="flex w-full mb-6 bg-gray-50 rounded-lg">
                <Tab
                  className={({ selected }: { selected: boolean }) =>
                    `flex-1 px-6 py-2 rounded-lg font-medium text-sm transition focus:outline-none ${selected ? "bg-white text-[#171A22] shadow" : "bg-gray-50 text-gray-500"}`
                  }
                >
                  {market.outcomes[0]}
                </Tab>
                <Tab
                  className={({ selected }: { selected: boolean }) =>
                    `flex-1 px-6 py-2 rounded-lg font-medium text-sm transition focus:outline-none ${selected ? "bg-white text-[#171A22] shadow" : "bg-gray-50 text-gray-500"}`
                  }
                >
                  {market.outcomes[1]}
                </Tab>
                <Tab
                  className={({ selected }: { selected: boolean }) =>
                    `flex-1 px-6 py-2 rounded-lg font-medium text-sm transition focus:outline-none ${selected ? "bg-white text-[#171A22] shadow" : "bg-gray-50 text-gray-500"}`
                  }
                >
                  Submit Document
                </Tab>
              </Tab.List>
              <Tab.Panels>
                {/* Yes Documents Tab */}
                <Tab.Panel>
                  {sortedYesEvidence.length === 0 ? (
                    <div className="text-gray-500">No evidence submitted yet.</div>
                  ) : (
                    <>
                      {yesToShow.map((evidence, idx) => (
                      <div
                        key={evidence.id}
                        className="mb-6 border rounded-lg px-6 pt-6 pb-3 bg-white shadow-sm border-gray-200"
                      >
                        <div className="flex">
                          {/* Voting column */}
                          <div className="flex flex-col items-center mr-4 select-none">
                            <button
                                className={`text-lg p-0 mb-1 transition-all duration-200 ${
                                  votingEvidenceId === evidence.id ? 'opacity-50 cursor-not-allowed' : ''
                                } ${userVotes.has(evidence.id) ? 'bg-green-600 rounded-lg p-1' : ''}`}
                                onClick={() => handleVote(evidence.id, 'yes')}
                                aria-label={userVotes.has(evidence.id) ? "Remove vote" : "Upvote"}
                              type="button"
                                disabled={votingEvidenceId === evidence.id}
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" className={userVotes.has(evidence.id) ? "text-white" : "text-green-600"} fill={userVotes.has(evidence.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <path d="M10 2v16" strokeLinecap="round"/>
                                  <path d="M5 7l5-5 5 5" strokeLinecap="round"/>
                                </svg>
                            </button>
                              <div className="flex flex-col items-center">
                                <div className={`bg-black text-white rounded-full px-1.5 py-0.5 text-xs font-semibold mb-1`} style={{minWidth: '1.48rem', textAlign: 'center'}}>
                              {evidence.netVotes}
                            </div>
                                <div className="text-green-600 text-xs font-semibold min-h-[1.25rem]" style={{minHeight: '1.25rem'}}>
                                  {userVotes.has(evidence.id) ? `+${getUserVotingContribution(evidence.id, 'yes')}` : <span className="opacity-0">+0</span>}
                                </div>
                              </div>
                          </div>
                          {/* Evidence content */}
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span className="text-sm font-semibold mr-2">#{idx + 1}</span>
                              <div className="flex-1">
                                {evidence.url ? (
                                  <a
                                    href={evidence.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-bold text-[#171A22] hover:underline text-[95%]"
                                      onClick={e => e.stopPropagation()} // Prevent expand/collapse when clicking link
                                  >
                                    {evidence.title} ({getDomain(evidence.url)})
                                  </a>
                                ) : (
                                  <span className="text-sm font-bold text-[#171A22] text-[95%]">{evidence.title}</span>
                                )}
                                <button
                                  className="text-xs text-gray-600 mt-2 hover:underline hover:text-blue-800 focus:outline-none block"
                                  type="button"
                                  onClick={() => setExpandedEvidenceId(expandedEvidenceId === evidence.id ? null : evidence.id)}
                                >
                                  {expandedEvidenceId === evidence.id ? 'Hide Replies' : 'View Replies'}
                                </button>
                              </div>
                            </div>
                              {/* Show comments section if expanded */}
                              {expandedEvidenceId === evidence.id && (
                                <EvidenceComments
                                  evidence={{ ...evidence, commentCount: evidence.commentCount ?? 0 }}
                                  currentUserAddress={account?.address}
                                />
                              )}
                          </div>
                        </div>
                      </div>
                      ))}
                      {sortedYesEvidence.length > 5 && (
                        <div className="flex justify-center mt-4">
                          <button
                            className="px-4 py-2 rounded bg-gray-100 text-black font-medium hover:bg-gray-200"
                            onClick={() => setShowAllYes(v => !v)}
                          >
                            {showAllYes ? 'View Less' : 'View More'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </Tab.Panel>
                {/* No Documents Tab */}
                <Tab.Panel>
                  {sortedNoEvidence.length === 0 ? (
                    <div className="text-gray-500">No evidence submitted yet.</div>
                  ) : (
                    <>
                      {sortedNoEvidence.map((evidence, idx) => (
                      <div
                        key={evidence.id}
                        className="mb-6 border rounded-lg px-6 pt-6 pb-3 bg-white shadow-sm border-gray-200"
                      >
                        <div className="flex">
                          {/* Voting column */}
                          <div className="flex flex-col items-center mr-4 select-none">
                            <button
                                className={`text-lg p-0 mb-1 transition-all duration-200 ${
                                  votingEvidenceId === evidence.id ? 'opacity-50 cursor-not-allowed' : ''
                                } ${userVotes.has(evidence.id) ? 'bg-green-600 rounded-lg p-1' : ''}`}
                                onClick={() => handleVote(evidence.id, 'no')}
                                aria-label={userVotes.has(evidence.id) ? "Remove vote" : "Upvote"}
                              type="button"
                                disabled={votingEvidenceId === evidence.id}
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" className={userVotes.has(evidence.id) ? "text-white" : "text-green-600"} fill={userVotes.has(evidence.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <path d="M10 2v16" strokeLinecap="round"/>
                                  <path d="M5 7l5-5 5 5" strokeLinecap="round"/>
                                </svg>
                            </button>
                              <div className="flex flex-col items-center">
                                <div className={`bg-black text-white rounded-full px-1.5 py-0.5 text-xs font-semibold mb-1`} style={{minWidth: '1.48rem', textAlign: 'center'}}>
                              {evidence.netVotes}
                            </div>
                                <div className="text-green-600 text-xs font-semibold min-h-[1.25rem]" style={{minHeight: '1.25rem'}}>
                                  {userVotes.has(evidence.id) ? `+${getUserVotingContribution(evidence.id, 'no')}` : <span className="opacity-0">+0</span>}
                                </div>
                              </div>
                          </div>
                          {/* Evidence content */}
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span className="text-sm font-semibold mr-2">#{idx + 1}</span>
                              <div className="flex-1">
                                {evidence.url ? (
                                  <a
                                    href={evidence.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-bold text-[#171A22] hover:underline text-[95%]"
                                      onClick={e => e.stopPropagation()} // Prevent expand/collapse when clicking link
                                  >
                                    {evidence.title} ({getDomain(evidence.url)})
                                  </a>
                                ) : (
                                  <span className="text-sm font-bold text-[#171A22] text-[95%]">{evidence.title}</span>
                                )}
                                <button
                                  className="text-xs text-gray-600 mt-2 hover:underline hover:text-blue-800 focus:outline-none block"
                                  type="button"
                                  onClick={() => setExpandedEvidenceId(expandedEvidenceId === evidence.id ? null : evidence.id)}
                                >
                                  {expandedEvidenceId === evidence.id ? 'Hide Replies' : 'View Replies'}
                                </button>
                              </div>
                            </div>
                              {/* Show comments section if expanded */}
                              {expandedEvidenceId === evidence.id && (
                                <EvidenceComments
                                  evidence={{ ...evidence, commentCount: evidence.commentCount ?? 0 }}
                                  currentUserAddress={account?.address}
                                />
                              )}
                          </div>
                        </div>
                      </div>
                      ))}
                      {sortedNoEvidence.length > 5 && (
                        <div className="flex justify-center mt-4">
                          <button
                            className="px-4 py-2 rounded bg-gray-100 text-black font-medium hover:bg-gray-200"
                            onClick={() => setShowAllNo(v => !v)}
                          >
                            {showAllNo ? 'View Less' : 'View More'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </Tab.Panel>
                {/* Submit Document Tab */}
                <Tab.Panel>
                  <form className="space-y-6 max-w-4xl" onSubmit={handleSubmitDocument}>
                    <div>
                      <label className="block font-medium text-gray-700 mb-2 text-[95%]">Evidence Type</label>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="evidenceType"
                            value="yes"
                            checked={evidenceType === 'yes'}
                            onChange={() => setEvidenceType('yes')}
                            className="accent-blue-600"
                          />
                          <span>Yes Evidence</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="evidenceType"
                            value="no"
                            checked={evidenceType === 'no'}
                            onChange={() => setEvidenceType('no')}
                            className="accent-blue-600"
                          />
                          <span>No Evidence</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-2 text-[95%]">Title</label>
                      <input
                        type="text"
                        placeholder="e.g., CIA Memo dated Sept 1963"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-2 text-[95%]">URL</label>
                      <input
                        type="text"
                        placeholder="Enter the URL of the document..."
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base"
                      />
                    </div>
                    {evidenceSuccessMessage && (
                      <div className="text-green-600 font-semibold text-center mb-2">{evidenceSuccessMessage}</div>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-[#171A22] text-white font-semibold py-3 rounded-lg text-lg hover:bg-[#232635] transition"
                    >
                      Submit Document
                    </button>
                  </form>
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </div>
        </div>
      </div>
    </div>
  );
} 