"use client";

import Navbar from "../../../../components/Navbar";
import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { getContractsForMarket, tokenContract} from "../../../../constants/contracts";
import { Tab } from "@headlessui/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

import { formatOddsToCents } from "../../../utils/formatOdds";
import { submitTrade } from "../../../utils/tradeApi";
import { getMarketById } from "../../../data/markets";
import { notFound } from "next/navigation";
import DenariusSymbol from "../../../components/DenariusSymbol";

// Backend API base URL - use Next.js API routes for both dev and production
const API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://question-ochre.vercel.app' : '';

// Helper to extract domain from URL
function getDomain(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Helper to check if URL is a PDF
  function isPdfUrl(url: string): boolean {
    return url.toLowerCase().includes('/uploads/evidence/') || 
           url.toLowerCase().includes('blob.vercel-storage.com') ||
           url.toLowerCase().endsWith('.pdf');
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
  const market = getMarketById(resolvedParams.marketId);
  
  // If market doesn't exist, show 404
  if (!market) {
    console.error('Market not found for ID:', resolvedParams.marketId);
    notFound();
  }

  // Helper function to truncate one digit from the end of a number string
  const truncateOneDigit = (num: number): string => {
    const numStr = num.toString();
    if (numStr.includes('.')) {
      // If it's a decimal number, remove the last digit
      return numStr.slice(0, -1);
    } else {
      // If it's a whole number, convert to decimal and remove last digit
      return (num / 10).toString();
    }
  };

  const account = useActiveAccount();
  const router = useRouter();

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

  // Split rules into paragraphs for better formatting
  function splitRules(text: string) {
    // Split by double newlines first
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    // If we have multiple paragraphs, return them as separate elements
    if (paragraphs.length > 1) {
      return paragraphs;
    }
    
    // Fallback: split into 3 paragraphs: Yes condition, No condition, Resolution statement
    const parts = [];
    
    // Split at "Otherwise, the market will resolve 'No.'"
    const noSplit = "Otherwise, the market will resolve 'No.'";
    const noIdx = text.indexOf(noSplit);
    
    if (noIdx !== -1) {
      // First part: Yes condition (everything before "Otherwise")
      parts.push(text.slice(0, noIdx).trim());
      
      // Find where resolution statement starts
      const resolutionSplit = "The market will resolve as soon as";
      const resolutionIdx = text.indexOf(resolutionSplit);
      
      if (resolutionIdx !== -1) {
        // Second part: No condition + clarification (from "Otherwise" to resolution)
        parts.push(text.slice(noIdx, resolutionIdx).trim());
        // Third part: Resolution statement
        parts.push(text.slice(resolutionIdx).trim());
      } else {
        // No resolution statement found, just split at "Otherwise"
        parts.push(text.slice(noIdx).trim());
      }
    } else {
      // No "Otherwise" found, return as single paragraph
      parts.push(text);
    }
    
    return parts.filter(p => p.trim());
  }

  // Replace individual yesMode and noMode with a single mode state
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');

  // Replace individual yesAmount and noAmount with a single amount state
  const [amount, setAmount] = useState("");
  const [sellAllClicked, setSellAllClicked] = useState(false);

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
  const { data: userTokenBalance, refetch: refetchUserTokenBalance } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address owner) view returns (uint256)",
    params: [account?.address || ""],
  });

  // Convert to 64x64 fixed point
  const userDeposit = userTokenBalance ? BigInt(userTokenBalance) * BigInt(2 ** 64) : 0n;

  const handleApproveIfNeeded = async () => {
    if (isAllowancePending || !account?.address) {
      console.error('Approval: allowance pending or no account', { isAllowancePending, account });
      return false;
    }
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
            console.log('Approval transaction succeeded');
            // Wait 4 seconds after approval
            await new Promise((r) => setTimeout(r, 4000));
            refetchAllowance();
            approved = true;
            resolve(true);
          },
          onError: (error) => {
            console.error('Approval transaction failed', error);
            resolve(false);
          },
        });
      });
      if (!approved) {
        console.error('Approval: transaction did not complete successfully');
      }
      return approved;
    }
    console.log('Approval: allowance sufficient', { allowance, userDeposit });
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
    const usdAmount = parseFloat(amount);
    // userTokenBalance is in wei (1e18), usdAmount is in dollars
    // If userTokenBalance is undefined, treat as 0
    const cashAvailable = userTokenBalance ? Number(userTokenBalance) / 1e18 : 0;
    if (usdAmount > cashAvailable) {
      setBuyFeedback("Please bet less than cash available!"); 
      setTimeout(() => setBuyFeedback(null), 3000);
      return;
    }
    setBuyFeedback("Checking approval (0/3)");
    const approved = await handleApproveIfNeeded();
    if (approved || (allowance && Number(allowance) >= userDeposit)) {
      setBuyFeedback(null);
      handleBuyYes(amount);
    } else {
      console.error('Approval failed or not completed', { approved, allowance, userDeposit });
      setBuyFeedback("Approval failed or not completed.");
    }
  };

  // Buy/Sell handlers
  const handleBuyYes = async (amount: string) => {
    if (!amount || !account?.address) return;
    setBuyFeedback("Preparing transaction (1/3)");
    const usdAmount = parseFloat(amount);
    
    // Convert full amount to USDC (18 decimals) for Base Sepolia
    const betAmountInUSDC = BigInt(Math.floor(usdAmount * 1e18));
    
    // Get the exact shares that will be received (using discounted amount for preview)
    const discountedBetAmount = usdAmount * 0.99;
    const discountedBetAmountInUSDC = BigInt(Math.floor(discountedBetAmount * 1e18));
    
    let sharesToBuy: number;
    try {
      const sharesResult = await readContract({
        contract: marketContract,
        method: "function calculateSharesFromBetAmount(uint256 _outcome, uint256 _betAmount) view returns (uint256 shares)",
        params: [yesIndex, discountedBetAmountInUSDC],
      });
      
      sharesToBuy = Number(sharesResult) / 1e18; // Shares returned in USDC units (6 decimals)
      
      if (isNaN(sharesToBuy) || sharesToBuy <= 0) {
        setBuyFeedback("Invalid price calculation. Please try again.");
        setTimeout(() => setBuyFeedback(null), 3000);
        return;
      }
    } catch (error) {
      console.error("calculateSharesFromBetAmount error:", error);
      setBuyFeedback("Please input a lower bet amount");
      setTimeout(() => setBuyFeedback(null), 3000);
      return;
    }
    
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function buy(uint256 _outcome, uint256 _betAmount) returns (uint256 shares)",
      params: [yesIndex, betAmountInUSDC],
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
          console.error("Parsed amount:", betAmountInUSDC.toString());
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
        const avgPrice = usdAmount / sharesToBuy;
        const tradeData = {
          walletAddress: account?.address || '',
          marketTitle: market.title,
          marketId: market.id, // Use the market ID string directly
          outcome: "Yes",
          shares: sharesToBuy,
          avgPrice: avgPrice,
          betAmount: usdAmount,
          toWin: sharesToBuy - usdAmount, // Update this formula as needed
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
  };

  const handleBuyNo = async (amount: string) => {
    if (!amount || !account?.address) return;
    setBuyFeedback("Preparing transaction (1/3)");
    const usdAmount = parseFloat(amount);
    
    // Convert full amount to USDC (6 decimals) for Base Sepolia
    const betAmountInUSDC = BigInt(Math.floor(usdAmount * 1e18));
    
    // Get the exact shares that will be received (using discounted amount for preview)
    const discountedBetAmount = usdAmount * 0.99;
    const discountedBetAmountInUSDC = BigInt(Math.floor(discountedBetAmount * 1e18));
    
    let sharesToBuy: number;
    try {
      const sharesResult = await readContract({
        contract: marketContract,
        method: "function calculateSharesFromBetAmount(uint256 _outcome, uint256 _betAmount) view returns (uint256 shares)",
        params: [noIndex, discountedBetAmountInUSDC],
      });
      
      sharesToBuy = Number(sharesResult) / 1e18; // Shares returned in USDC units (6 decimals)
      
      if (isNaN(sharesToBuy) || sharesToBuy <= 0) {
        setBuyFeedback("Invalid price calculation. Please try again.");
        setTimeout(() => setBuyFeedback(null), 3000);
        return;
      }
    } catch (error) {
      console.error("calculateSharesFromBetAmount error:", error);
      setBuyFeedback("Please input a lower bet amount");
      setTimeout(() => setBuyFeedback(null), 3000);
      return;
    }
    
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function buy(uint256 _outcome, uint256 _betAmount) returns (uint256 shares)",
      params: [noIndex, betAmountInUSDC],
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
          console.error("Parsed amount:", betAmountInUSDC.toString());
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
            const avgPrice = usdAmount / sharesToBuy;
            const tradeData = {
              walletAddress: account?.address || '',
              marketTitle: market.title,
              marketId: market.id, // Use the market ID string directly
              outcome: "No",
              shares: sharesToBuy,
              avgPrice: avgPrice,
              betAmount: usdAmount,
              toWin: sharesToBuy - usdAmount, // Update this formula as needed
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
  };

  const handleBuyNoWithApproval = async (amount: string) => {
    if (!handleWalletCheck()) return;
    const usdAmount = parseFloat(amount);
    const cashAvailable = userTokenBalance ? Number(userTokenBalance) / 1e18 : 0;
    if (usdAmount > cashAvailable) {
      setBuyFeedback("Please bet less than cash available");
      setTimeout(() => setBuyFeedback(null), 3000);
      return;
    }
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
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [uploadType, setUploadType] = useState<'url' | 'pdf'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Add state for evidence submission success message
  const [evidenceSuccessMessage, setEvidenceSuccessMessage] = useState<string | null>(null);
  
  // Add state for sign-in modal
  const [showSignInModal, setShowSignInModal] = useState(false);

 // Handle automatic price calculation
 const handleAutoGetPrice = useCallback(async (outcome: number, amount: number, isSellMode: boolean = false) => {
  setIsPricePending(true);
  setPriceError(null);
  setPriceResult(undefined);
  try {
    if (isSellMode) {
      // For sell mode, input is number of shares, convert to Wei format (like buy functions)
      const shareAmount = amount;
      const shareAmountInUSDC = BigInt(Math.floor(shareAmount * 1e18));
      
      const result = await readContract({
        contract: marketContract,
        method: "function calculateSellRefund(uint256 _outcome, uint256 _amount) view returns (uint256 refund)",
        params: [BigInt(outcome), shareAmountInUSDC],
      });
      setPriceResult(result);
      console.log('Auto sell price result:', {
        rawResult: result.toString(),
        shareAmount: shareAmount,
        shareAmountInUSDC: shareAmountInUSDC.toString(),
        refundReceived: Number(result) / 1e18,
        outcome,
        amount
      });
    } else {
      // For buy mode, apply 2% discount (overround) to the bet amount
      const discountedBetAmount = amount * 0.99; // 2% discount
      
      // Convert discounted bet amount to USDC (multiply by 10^6 for Base Sepolia)
      const betAmountInUSDC = BigInt(Math.floor(discountedBetAmount * 1e18));
      
      const result = await readContract({
        contract: marketContract,
        method: "function calculateSharesFromBetAmount(uint256 _outcome, uint256 _betAmount) view returns (uint256 shares)",
        params: [BigInt(outcome), betAmountInUSDC],
      });
      setPriceResult(result);
      console.log('Auto buy price result:', {
        rawResult: result.toString(),
        originalBetAmount: amount,
        discountedBetAmount: discountedBetAmount,
        betAmountInUSDC: betAmountInUSDC.toString(),
        sharesReceived: Number(result) / 1e18, // Shares returned in USDC units (6 decimals)
        outcome,
        amount
      });
    }
  } catch (error) {
    console.error('Auto price function error:', error);
    
    // Any error from the contract functions is likely due to amount being too high
    setPriceError(new Error("Please enter a smaller amount"));
  } finally {
    setIsPricePending(false);
  }
}, [marketContract]);

useEffect(() => {
  if (selectedOutcome && amount && parseFloat(amount) > 0) {
    const outcome = selectedOutcome === 'yes' ? 0 : 1;
    const amountValue = parseFloat(amount);
    if (!isNaN(amountValue) && amountValue > 0) {
      handleAutoGetPrice(outcome, amountValue, mode === 'sell');
    }
  }
}, [selectedOutcome, amount, mode, handleAutoGetPrice]);







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
    fetch(`${API_BASE_URL}/api/evidence?marketId=${market.id}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
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

      console.log('balance1Str:', balance1Str);
      console.log('balance2Str:', balance2Str);
      
      // Convert to real token amounts by dividing by 10^18 and remove decimals
      const yesShares = (Number(balance1Str) / 1e18).toString();
      const noShares = (Number(balance2Str) / 1e18).toString();
      
      
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
      const yesShares = (Number(balance1Str) / 1e18).toString();
      const noShares = (Number(balance2Str) / 1e18).toString();
      
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

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (file.type !== 'application/pdf') {
        alert('Please select a PDF file only.');
        e.target.value = ''; // Clear the input
        return;
      }
      
      // Check file size (10MB = 10 * 1024 * 1024 bytes)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        alert(`File size must be less than 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
        e.target.value = ''; // Clear the input
        setSelectedFile(null); // Clear selected file state
        return;
      }
      
      // File is valid
      setSelectedFile(file);
      setUrl(''); // Clear URL when file is selected
    }
  };

  // Handle submit document
  const handleSubmitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is signed in
    if (!account?.address) {
      setEvidenceSuccessMessage('Please sign-in to contribute information');
      setTimeout(() => setEvidenceSuccessMessage(null), 5000);
      return;
    }
    
    if (!title.trim()) return;
    
    // Validate based on upload type
    if (uploadType === 'url' && !url.trim()) {
      alert('Please enter a URL or switch to PDF upload.');
      return;
    }
    if (uploadType === 'pdf' && !selectedFile) {
      alert('Please select a PDF file or switch to URL.');
      return;
    }

    setIsUploading(true);
    
    try {
      let finalUrl = url.trim();
      
      // If PDF upload, we'll need to upload the file first
      if (uploadType === 'pdf' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('marketId', market.id);
        formData.append('evidenceType', evidenceType);
        formData.append('title', title.trim());
        formData.append('walletAddress', account?.address || '');
        
        const uploadRes = await fetch(`${API_BASE_URL}/api/upload-evidence`, {
          method: 'POST',
          headers: {
            'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'your-api-key-here',
          },
          body: formData,
        });
        
        if (!uploadRes.ok) {
          throw new Error('Failed to upload PDF');
        }
        
        const uploadResult = await uploadRes.json();
        finalUrl = uploadResult.fileUrl; // Get the uploaded file URL
      }
      
      // Submit evidence with the URL (either original URL or uploaded PDF URL)
      const newEvidence = {
        marketId: market.id,
        type: evidenceType,
        title: title.trim(),
        url: finalUrl,
        description: description.trim(),
        walletAddress: account?.address || '',
      };
      
      const res = await fetch(`${API_BASE_URL}/api/submit-evidence`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
          // No API key needed - handled server-side
        },
        body: JSON.stringify(newEvidence),
      });
      
      const result = await res.json();
      const created = result.success ? result.data : result;
      setEvidence(prev => [created, ...prev]);
      setTitle('');
      setDescription('');
      setUrl('');
      setSelectedFile(null);
      setEvidenceType('yes');
      setUploadType('url');
      setEvidenceSuccessMessage('Evidence Successfully Submitted!');
      setTimeout(() => setEvidenceSuccessMessage(null), 10000);
    } catch (error) {
      console.error('Error submitting evidence:', error);
      setEvidenceSuccessMessage('Error submitting evidence. Please try again.');
      setTimeout(() => setEvidenceSuccessMessage(null), 10000);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle upvote/downvote toggle
  const handleVote = async (id: number, evidenceType: 'yes' | 'no') => {
    if (!account?.address) {
      setShowSignInModal(true);
      return;
    }
    
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

  // Calculate payout and average price for the selected outcome
  let payoutDisplay = '--';
  let avgPriceDisplay = '--';
  if (selectedOutcome && amount && !isNaN(Number(amount)) && Number(amount) > 0) {
    if (priceResult !== undefined && !isPricePending && !priceError) {
      if (mode === 'sell') {
        // Use the actual refund amount from calculateSellRefund for sell mode
        const refundReceived = Number(priceResult) / 1e18; // Convert from Wei to USD
        const shareAmount = parseFloat(amount);
        
        // For sell mode, the refund amount is the payout
        payoutDisplay = refundReceived.toFixed(2);
        // Calculate average price: (refund received / shares sold) * 100 cents
        const avgPriceInCents = (refundReceived / shareAmount) * 100;
        avgPriceDisplay = `¢${avgPriceInCents.toFixed(0)}`;
        
        // Debug logging for sell priceResult calculations
        console.log('=== SELL PRICE RESULT CALCULATIONS ===');
        console.log('Raw priceResult (refund in Wei):', priceResult.toString());
        console.log('refundReceived (converted from Wei):', refundReceived);
        console.log('shareAmount (user input):', shareAmount);
        console.log('payoutDisplay (refund received):', payoutDisplay);
        console.log('avgPrice calculation: (refundReceived / shareAmount) * 100 =', avgPriceInCents);
        console.log('avgPriceDisplay (rounded):', avgPriceDisplay);
        console.log('================================');
      } else {
        // Use the actual shares from calculateSharesFromBetAmount for buy mode
        const sharesReceived = Number(priceResult) / 1e18; // Convert from Wei to shares
        const amountNum = parseFloat(amount);
        
        // Calculate average price: (user's bet amount / shares received) * 100 cents
        const avgPriceInCents = (amountNum / sharesReceived) * 100;
        const totalReturn = sharesReceived; // $1 per share * number of shares
        payoutDisplay = totalReturn.toFixed(2);
        avgPriceDisplay = `¢${avgPriceInCents.toFixed(0)}`;
        
        // Debug logging for buy priceResult calculations
        console.log('=== BUY PRICE RESULT CALCULATIONS ===');
        console.log('Raw priceResult (shares in Wei):', priceResult.toString());
        console.log('sharesReceived (converted from Wei):', sharesReceived);
        console.log('amountNum (user input):', amountNum);
        console.log('Discounted amount used in contract call:', amountNum * 0.98);
        console.log('Overround adjustment: 2% discount applied');
        console.log('avgPrice calculation: (amountNum / sharesReceived) * 100 =', avgPriceInCents);
        console.log('avgPriceDisplay (rounded):', avgPriceDisplay);
        console.log('totalReturn (shares received):', totalReturn);
        console.log('================================');
      }
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
          payoutDisplay = payout.toFixed(2);
        }
        avgPriceDisplay = `¢${(oddsNum * 100).toFixed(0)}`;
      }
    }
  }

  // Wait for transaction confirmation and update balances
  const waitForTransactionConfirmation = async (transactionResult: unknown, successMessage: string) => {
    try {
      // Wait for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update balances immediately after confirmation
      await fetchUserBalancesWithoutLoading();
      
      // Refetch user's token balance to update cash display
      await refetchUserTokenBalance();
      
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
      setAmount(""); // Clear the amount only after transaction is fully completed
      
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
      setAmount(""); // Clear the amount even if there's an error
    }
  };

  // Calculate user's voting power for Yes and No
  const yesShares = parseInt(outcome1Balance) || 0;
  const noShares = parseInt(outcome2Balance) || 0;
  
  // If user has shares in one position, they have zero voting power for the opposite position
  const yesVotingPower = account?.address ? ((yesShares - noShares) > 0 ? Math.max(1, yesShares - noShares) : 0) : 0;
  const noVotingPower = account?.address ? ((noShares - yesShares) > 0 ? Math.max(1, noShares - yesShares) : 0) : 0;

  // For conditional tokens approval (for selling)
  const { mutate: sendSetApprovalForAll } = useSendTransaction();
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
      const oddsResponse = await fetch(`${API_BASE_URL}/api/record-odds`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
          // No API key needed - handled server-side
        },
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
          <div className="bg-white p-6 mx-4" style={{ maxWidth: '375px' }}>
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
      <div className="min-h-screen bg-white w-full">
        <div className="max-w-[1600px] mx-auto w-full">
          <div className="w-full flex flex-col lg:flex-row gap-0.5 pt-2.5">
            {/* Combined Market Odds + Evidence Card */}
            <div className="bg-white p-2.5 sm:pl-8 sm:pr-2.5 w-full lg:w-[calc(100%-350px)] mb-8 lg:mb-0 flex flex-col">
              {/* Odds History Chart Card */}
              <h2 className="text-2xl font-bold mb-6 text-[#171A22]">{market.title}</h2>
              <div className="mb-2">
                <span className="text-lg font-semibold text-[#171A22]">Market Odds</span>
              </div>
              {/* Live Yes/No Probabilities Display - now in its own container */}
              <div className="mb-0 pl-[0px] pr-1 text-sm font-bold text-[#171A22]">
                {typeof oddsYes === 'bigint' && typeof oddsNo === 'bigint' ? (
                  <>
                    <span className="text-green-600">Yes: {Math.round(Number(oddsYes) / Math.pow(2, 64) * 100)}%</span>
                    <span className="mx-2 text-red-600">No: {Math.round(Number(oddsNo) / Math.pow(2, 64) * 100)}%</span>
                  </>
                ) : (
                  <>
                    <span className="text-green-600">Yes: --%</span>
                    <span className="mx-2 text-red-600">No: --%</span>
                  </>
                )}
              </div>
              {loadingOdds ? (
                <div className="text-gray-500">Loading chart...</div>
              ) : (
                <div className="relative w-full h-[300px]">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 20, right: 0, left: 5, bottom: 0 }}>
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
                      <ReferenceLine y={0.25} stroke="#bdbdbd" strokeDasharray="4 4" />
                      <ReferenceLine y={0.5} stroke="#bdbdbd" strokeDasharray="4 4" />
                      <ReferenceLine y={0.75} stroke="#bdbdbd" strokeDasharray="4 4" />
                      <ReferenceLine y={1} stroke="#bdbdbd" strokeDasharray="4 4" />
                      <Line type="linear" dataKey="Yes" stroke="#22c55e" dot={false} name="Yes Probability" />
                      <Line type="linear" dataKey="No" stroke="#ef4444" dot={false} name="No Probability" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
              {/* On mobile, show Buy/Sell card here, after Rules and before Evidence */}
              <div className="block lg:hidden w-full mt-4">
                {/* Top solid grey border */}
                <div className="w-full h-px bg-gray-200 mb-7"></div>
                {/* Betting Card (mobile) */}
                <div className="bg-white p-0 w-full max-w-[600px]">
                  {/* Buy/Sell Toggle */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-2">
                      <button
                        className={`py-1 px-3 text-base rounded-full border ${mode === 'buy' ? 'bg-gray-100 text-green-600 border-gray-300 font-bold' : 'bg-white text-black border-gray-300 font-normal'}`}
                        onClick={() => {
                          setMode('buy');
                          setAmount("");
                          setSellAllClicked(false);
                          setSelectedOutcome(null);
                        }}
                        type="button"
                      >
                        Buy
                      </button>
                      <button
                        className={`py-1 px-3 text-base rounded-full border ${mode === 'sell' ? 'bg-gray-100 text-green-600 border-gray-300 font-bold' : 'bg-white text-black border-gray-300 font-normal'}`}
                        onClick={() => {
                          setMode('sell');
                          setAmount("");
                          setSellAllClicked(false);
                          setSelectedOutcome(null);
                        }}
                        type="button"
                      >
                        Sell
                      </button>
                    </div>
                    {/* Cash/Share Display for Mobile */}
                    <div className="text-right mr-2">
                      {mode === 'buy' ? (
                        <div className="text-sm font-semibold text-green-600">
                          Cash: {(!account?.address) ? <><DenariusSymbol size={10} />--</> : (() => {
                            if (!userTokenBalance) return <><DenariusSymbol size={10} />0</>;
                            const amount = Number(userTokenBalance) / 1e18;
                            return <><DenariusSymbol size={10} />{amount % 1 === 0 
                              ? amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
                              : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            }</>;
                          })()}
                        </div>
                      ) : (
                        <div className="text-sm font-semibold text-green-600 flex flex-col items-end">
                          <span className="text-green-600">Yes Shares: {isBalanceLoading ? '...' : (outcome1Balance !== '--' && outcome1Balance !== 'Error' ? parseFloat(outcome1Balance).toFixed(2) : outcome1Balance)}</span>
                          <span className="text-red-600">No Shares: {isBalanceLoading ? '...' : (outcome2Balance !== '--' && outcome2Balance !== 'Error' ? parseFloat(outcome2Balance).toFixed(2) : outcome2Balance)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Bet Amount sub-title */}
                  <div className="text-lg font-bold mb-2">{mode === 'buy' ? <>Bet Amount (<DenariusSymbol size={12} />)</> : 'Sell Shares'}</div>
                  {/* Amount input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={`Enter ${mode === 'buy' ? 'Buy' : 'Sell'} Amount`}
                      value={amount || ''}
                      onChange={e => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        setAmount(value);
                        setSellAllClicked(false);
                      }}
                      className={`w-full ${mode === 'buy' && amount ? 'pl-4' : 'pl-3'} pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-base mb-4`}
                    />
                    {mode === 'buy' && amount && (
                      <div className="absolute left-1" style={{ top: '50%', transform: 'translateY(-50%)', marginTop: '-8px' }}>
                        <DenariusSymbol size={11} />
                      </div>
                    )}
                  </div>
                  {/* Yes/No Cent Price buttons */}
                  <div className="flex flex-row w-full mb-4 gap-2">
                    <button
                      type="button"
                      className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white w-1/2 ${selectedOutcome === 'yes' ? 'ring-2 ring-black' : ''}`}
                      onClick={() => {
                      setSelectedOutcome('yes');
                      // If Sell All is active, update input to show Yes shares
                      if (sellAllClicked) {
                        const yesShares = outcome1Balance !== '--' && outcome1Balance !== 'Error' ? parseFloat(outcome1Balance) : 0;
                        setAmount(truncateOneDigit(yesShares));
                        console.log('Sell All active - updated input to Yes shares:', yesShares);
                      } else {
                        setSellAllClicked(false);
                      }
                    }}
                    >
                      {mode === 'buy'
                        ? (buyYesStatus === 'pending' ? 'Buying...' : `Yes ${formatOddsToCents(oddsYes)}`)
                        : (buyYesStatus === 'pending' ? 'Selling...' : `Yes ${formatOddsToCents(oddsYes)}`)}
                    </button>
                    <button
                      type="button"
                      className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-red-600 hover:bg-red-700 text-white w-1/2 ${selectedOutcome === 'no' ? 'ring-2 ring-black' : ''}`}
                      onClick={() => {
                      setSelectedOutcome('no');
                      // If Sell All is active, update input to show No shares
                      if (sellAllClicked) {
                        const noShares = outcome2Balance !== '--' && outcome2Balance !== 'Error' ? parseFloat(outcome2Balance) : 0;
                        setAmount(truncateOneDigit(noShares));
                        console.log('Sell All active - updated input to No shares:', noShares);
                      } else {
                        setSellAllClicked(false);
                      }
                    }}
                    >
                      {mode === 'buy'
                        ? (buyNoStatus === 'pending' ? 'Buying...' : `No ${formatOddsToCents(oddsNo)}`)
                        : (buyNoStatus === 'pending' ? 'Selling...' : `No ${formatOddsToCents(oddsNo)}`)}
                    </button>
                  </div>
                  {/* Sell All button - only show on sell mode when user has shares */}
                  {mode === 'sell' && (
                    (outcome1Balance !== '--' && outcome1Balance !== 'Error' && parseInt(outcome1Balance) > 0) ||
                    (outcome2Balance !== '--' && outcome2Balance !== 'Error' && parseInt(outcome2Balance) > 0)
                  ) && (
                    <div className="flex justify-start mb-4">
                      <button
                        className={`py-1 px-3 text-base rounded-full border transition-colors ${sellAllClicked ? 'bg-gray-100 text-green-600 border-gray-300 font-bold' : 'bg-white text-black border-gray-300 font-normal hover:bg-gray-50'}`}
                        onClick={() => {      
                          if (sellAllClicked) {
                            // Second click: return to normal state and clear input
                            setSellAllClicked(false);
                            setAmount("");
                            setSelectedOutcome(null);
                            console.log('Sell All button deactivated, input cleared, outcome deselected');
                          } else {
                            // First click: activate button and populate input
                            setSellAllClicked(true);
                            
                            // Calculate shares for each outcome
                            const yesShares = outcome1Balance !== '--' && outcome1Balance !== 'Error' ? parseFloat(outcome1Balance) : 0;
                            const noShares = outcome2Balance !== '--' && outcome2Balance !== 'Error' ? parseFloat(outcome2Balance) : 0;
                            
                            // Check if user has already selected an outcome
                            if (selectedOutcome === 'yes') {
                              // User already selected Yes - input Yes shares (truncated)
                              setAmount(truncateOneDigit(yesShares));
                              console.log('User already selected Yes - inputting Yes shares:', yesShares);
                            } else if (selectedOutcome === 'no') {
                              // User already selected No - input No shares (truncated)
                              setAmount(truncateOneDigit(noShares));
                              console.log('User already selected No - inputting No shares:', noShares);
                            } else {
                              // No outcome selected - default to larger position (truncated)
                              const largerPosition = Math.max(yesShares, noShares);
                              const outcomeWithMoreShares = yesShares >= noShares ? 'yes' : 'no';
                              
                              setAmount(truncateOneDigit(largerPosition));
                              setSelectedOutcome(outcomeWithMoreShares);
                              
                              console.log('No outcome selected - defaulting to larger position:', largerPosition);
                              console.log('Automatically selected outcome:', outcomeWithMoreShares);
                            }
                            
                            // Debug: Print the parsed values
                            console.log('Parsed yesShares:', yesShares);
                            console.log('Parsed noShares:', noShares);
                            console.log('Final amount set to input:', yesShares > noShares ? yesShares : noShares);
                          }
                        }}
                      >
                        Sell All
                      </button>
                    </div>
                  )}
                  {/* Only show Max. Win, Avg Price, and Submit Trade if amount and selectedOutcome are set */}
                  {amount && !isNaN(Number(amount)) && selectedOutcome && (
                    <>
                      {/* Max. Win/Receive sub-title */}
                      <div className="text-[1.15rem] font-medium text-black">{mode === 'buy' ? 'Max. Win:' : 'Receive:'} <span className="text-green-600 font-bold"><span className="font-normal"><DenariusSymbol size={13} /></span> {payoutDisplay}</span></div>
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
                    </>
                  )}
                  {/* Your Balance Section */}
                  <div className="border-t border-gray-200 pt-4 mt-4 hidden lg:block">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Purchased Shares</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-green-600 mb-1">Yes Shares</div>
                        <div className="text-lg font-bold text-gray-800">{isBalanceLoading ? "..." : (outcome1Balance !== '--' && outcome1Balance !== 'Error' ? parseFloat(outcome1Balance).toFixed(2) : outcome1Balance)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-red-600 mb-1">No Shares</div>
                        <div className="text-lg font-bold text-gray-800">{isBalanceLoading ? "..." : (outcome2Balance !== '--' && outcome2Balance !== 'Error' ? parseFloat(outcome2Balance).toFixed(2) : outcome2Balance)}</div>
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
                {/* Bottom solid grey border */}
                <div className="w-full h-px bg-gray-200 mt-6"></div>
              </div>
              {/* Evidence Section (always at the bottom of the combined card) */}
              <div className="w-full mt-8 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-[18px] font-bold text-[#171A22]">Evidence</h2>
                  {/* Voting Power Display */}
                  <div className="flex items-center space-x-2 text-xs font-medium text-sm">
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
                        <div className="text-gray-500 text-sm">No evidence submitted yet.</div>
                      ) : (
                        <>
                          {yesToShow.map((evidence, idx) => (
                          <div
                            key={evidence.id}
                            className="mb-6 border rounded-lg px-6 pt-6 pb-3 bg-white shadow-sm border-gray-200 text-sm"
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
                                  <span className="font-semibold mr-2">#{idx + 1}</span>
                                  <div className="flex-1">
                                    {evidence.url ? (
                                      <a
                                        href={evidence.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold text-[#171A22] hover:underline text-[95%]"
                                        onClick={e => e.stopPropagation()} // Prevent expand/collapse when clicking link
                                      >
                                        {evidence.title} ({isPdfUrl(evidence.url) ? 'pdf' : getDomain(evidence.url)})
                                      </a>
                                    ) : (
                                      <span className="font-bold text-[#171A22] text-[95%]">{evidence.title}</span>
                                    )}
                                    <button
                                      className="text-xs text-gray-600 mt-2 hover:underline hover:text-blue-800 focus:outline-none block"
                                      type="button"
                                      onClick={() => router.push(`/evidence/discussion/${evidence.id}`)}
                                    >
                                      View Discussion
                                    </button>
                                  </div>
                                </div>
                                  {/* Show comments section if expanded */}
            
                              </div>
                            </div>
                          </div>
                          ))}
                          {sortedYesEvidence.length > 5 && (
                            <div className="flex justify-center mt-4">
                              <button
                                className="px-4 py-2 rounded bg-gray-100 text-black font-medium hover:bg-gray-200 text-sm"
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
                        <div className="text-gray-500 text-sm">No evidence submitted yet.</div>
                      ) : (
                        <>
                          {sortedNoEvidence.map((evidence, idx) => (
                          <div
                            key={evidence.id}
                            className="mb-6 border rounded-lg px-6 pt-6 pb-3 bg-white shadow-sm border-gray-200 text-sm"
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
                                  <span className="font-semibold mr-2">#{idx + 1}</span>
                                  <div className="flex-1">
                                    {evidence.url ? (
                                      <a
                                        href={evidence.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold text-[#171A22] hover:underline text-[95%]"
                                        onClick={e => e.stopPropagation()} // Prevent expand/collapse when clicking link
                                      >
                                        {evidence.title} ({isPdfUrl(evidence.url) ? 'pdf' : getDomain(evidence.url)})
                                      </a>
                                    ) : (
                                      <span className="font-bold text-[#171A22] text-[95%]">{evidence.title}</span>
                                    )}
                                    <button
                                      className="text-xs text-gray-600 mt-2 hover:underline hover:text-blue-800 focus:outline-none block"
                                      type="button"
                                      onClick={() => router.push(`/evidence/discussion/${evidence.id}`)}
                                    >
                                      View Discussion
                                    </button>
                                  </div>
                                </div>
                                  {/* Show comments section if expanded */}
   
                              </div>
                            </div>
                          </div>
                          ))}
                          {sortedNoEvidence.length > 5 && (
                            <div className="flex justify-center mt-4">
                              <button
                                className="px-4 py-2 rounded bg-gray-100 text-black font-medium hover:bg-gray-200 text-sm"
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
                          <label className="block font-medium text-gray-700 mb-2 text-[95%]">Description (Optional)</label>
                          <textarea
                            placeholder="Provide additional context or details about this evidence..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base resize-none"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-gray-700 mb-2 text-[95%]">Document Source</label>
                          <div className="flex items-center gap-6 mb-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="uploadType"
                                value="url"
                                checked={uploadType === 'url'}
                                onChange={() => {
                                  setUploadType('url');
                                  setSelectedFile(null);
                                }}
                                className="accent-blue-600"
                              />
                              <span>URL Link</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="uploadType"
                                value="pdf"
                                checked={uploadType === 'pdf'}
                                onChange={() => {
                                  setUploadType('pdf');
                                  setUrl('');
                                }}
                                className="accent-blue-600"
                              />
                              <span>PDF Upload</span>
                            </label>
                          </div>
                          {uploadType === 'url' ? (
                            <input
                              type="text"
                              placeholder="Enter the URL of the document..."
                              value={url}
                              onChange={e => setUrl(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base"
                            />
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Maximum file size: 10MB
                              </p>
                              {selectedFile && (
                                <p className="mt-2 text-sm text-green-600">
                                  ✓ Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)}MB)
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        {evidenceSuccessMessage && (
                          <div className="text-black font-semibold text-center mb-2">{evidenceSuccessMessage}</div>
                        )}
                        <button
                          type="submit"
                          disabled={isUploading}
                          className="w-full bg-[#171A22] text-white font-semibold py-3 rounded-lg text-lg hover:bg-[#232635] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUploading ? 'Uploading...' : 'Submit Document'}
                        </button>
                      </form>
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>
              </div>
            </div>
            {/* Betting Card (desktop) */}
            <div className="hidden lg:block bg-white shadow p-4 sm:max-w-4xl sm:mx-auto sm:p-8 lg:w-[315px] lg:self-start">
              {/* Buy/Sell Toggle */}
              <div className="flex items-center mb-2">
                <div className="flex gap-2">
                  <button
                    className={`py-1 px-3 text-base rounded-full border ${mode === 'buy' ? 'bg-gray-100 text-green-600 border-gray-300 font-bold' : 'bg-white text-black border-gray-300 font-normal'}`}
                    onClick={() => {
                      setMode('buy');
                      setAmount("");
                      setSellAllClicked(false);
                      setSelectedOutcome(null);
                    }}
                    type="button"
                  >
                    Buy
                  </button>
                  <button
                    className={`py-1 px-3 text-base rounded-full border ${mode === 'sell' ? 'bg-gray-100 text-green-600 border-gray-300 font-bold' : 'bg-white text-black border-gray-300 font-normal'}`}
                    onClick={() => {
                      setMode('sell');
                      setAmount("");
                      setSellAllClicked(false);
                      setSelectedOutcome(null);
                    }}
                    type="button"
                  >
                    Sell
                  </button>
                </div>
              </div>
              {/* Bet Amount sub-title */}
              <div className="text-lg font-bold mb-2">{mode === 'buy' ? <>Bet Amount (<DenariusSymbol size={11} />)</> : 'Sell Shares'}</div>
              {/* Amount input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder={`Enter ${mode === 'buy' ? 'Buy' : 'Sell'} Amount`}
                  value={amount || ''}
                  onChange={e => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    setAmount(value);
                    setSellAllClicked(false);
                  }}
                  className={`w-full ${mode === 'buy' && amount ? 'pl-5' : 'pl-3'} pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-base mb-4`}
                />
                {mode === 'buy' && amount && (
                  <div className="absolute left-2" style={{ top: '50%', transform: 'translateY(-50%)', marginTop: '-8px' }}>
                    <DenariusSymbol size={11} />
                  </div>
                )}
              </div>
              {/* Yes/No Cent Price buttons */}
              <div className="flex flex-row w-full mb-4 gap-2">
                <button
                  type="button"
                  className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white w-1/2 ${selectedOutcome === 'yes' ? 'ring-2 ring-black' : ''}`}
                                        onClick={() => {
                        setSelectedOutcome('yes');
                        // If Sell All is active, update input to show Yes shares
                        if (sellAllClicked) {
                          const yesShares = outcome1Balance !== '--' && outcome1Balance !== 'Error' ? parseFloat(outcome1Balance) : 0;
                          setAmount(truncateOneDigit(yesShares));
                          console.log('Sell All active - updated input to Yes shares:', yesShares);
                        } else {
                          setSellAllClicked(false);
                        }
                      }}
                >
                  {mode === 'buy'
                    ? (buyYesStatus === 'pending' ? 'Buying...' : `Yes ${formatOddsToCents(oddsYes)}`)
                    : (buyYesStatus === 'pending' ? 'Selling...' : `Yes ${formatOddsToCents(oddsYes)}`)}
                </button>
                <button
                  type="button"
                  className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-red-600 hover:bg-red-700 text-white w-1/2 ${selectedOutcome === 'no' ? 'ring-2 ring-black' : ''}`}
                                        onClick={() => {
                        setSelectedOutcome('no');
                        // If Sell All is active, update input to show No shares
                        if (sellAllClicked) {
                          const noShares = outcome2Balance !== '--' && outcome2Balance !== 'Error' ? parseFloat(outcome2Balance) : 0;
                          setAmount(truncateOneDigit(noShares));
                          console.log('Sell All active - updated input to No shares:', noShares);
                        } else {
                          setSellAllClicked(false);
                        }
                      }}
                >
                  {mode === 'buy'
                    ? (buyNoStatus === 'pending' ? 'Buying...' : `No ${formatOddsToCents(oddsNo)}`)
                    : (buyNoStatus === 'pending' ? 'Selling...' : `No ${formatOddsToCents(oddsNo)}`)}
                </button>
              </div>
              {/* Sell All button - only show on sell mode when user has shares */}
              {mode === 'sell' && (
                (outcome1Balance !== '--' && outcome1Balance !== 'Error' && parseFloat(outcome1Balance) > 0) ||
                (outcome2Balance !== '--' && outcome2Balance !== 'Error' && parseFloat(outcome2Balance) > 0)
              ) && (
                <div className="flex justify-start mb-4">
                  <button
                                            className={`py-1 px-3 text-base rounded-full border transition-colors ${sellAllClicked ? 'bg-gray-100 text-green-600 border-gray-300 font-bold' : 'bg-white text-black border-gray-300 font-normal hover:bg-gray-50'}`}
                                            onClick={() => {      
                          if (sellAllClicked) {
                            // Second click: return to normal state and clear input
                            setSellAllClicked(false);
                            setAmount("");
                            setSelectedOutcome(null);
                            console.log('Sell All button deactivated, input cleared, outcome deselected');
                          } else {
                            // First click: activate button and populate input
                            setSellAllClicked(true);
                            
                            // Calculate shares for each outcome
                            const yesShares = outcome1Balance !== '--' && outcome1Balance !== 'Error' ? parseFloat(outcome1Balance) : 0;
                            const noShares = outcome2Balance !== '--' && outcome2Balance !== 'Error' ? parseFloat(outcome2Balance) : 0;
                            
                            // Check if user has already selected an outcome
                            if (selectedOutcome === 'yes') {
                              // User already selected Yes - input Yes shares (truncated)
                              setAmount(truncateOneDigit(yesShares));
                              console.log('User already selected Yes - inputting Yes shares:', yesShares);
                            } else if (selectedOutcome === 'no') {
                              // User already selected No - input No shares (truncated)
                              setAmount(truncateOneDigit(noShares));
                              console.log('User already selected No - inputting No shares:', noShares);
                            } else {
                              // No outcome selected - default to larger position (truncated)
                              const largerPosition = Math.max(yesShares, noShares);
                              const outcomeWithMoreShares = yesShares >= noShares ? 'yes' : 'no';
                              
                              setAmount(truncateOneDigit(largerPosition));
                              setSelectedOutcome(outcomeWithMoreShares);
                              
                              console.log('No outcome selected - defaulting to larger position:', largerPosition);
                              console.log('Automatically selected outcome:', outcomeWithMoreShares);
                            }
                            
                            // Debug: Print the parsed values
                            console.log('Parsed yesShares:', yesShares);
                            console.log('Parsed noShares:', noShares);
                            console.log('Final amount set to input:', yesShares > noShares ? yesShares : noShares);
                          }
                        }}
                  >
                    Sell All
                  </button>
                </div>
              )}
              {/* Only show Max. Win, Avg Price, and Submit Trade if amount and selectedOutcome are set */}
              {amount && !isNaN(Number(amount)) && selectedOutcome && (
                <>
                  {/* Max. Win/Receive sub-title */}
                  <div className="text-[1.15rem] font-medium text-black">{mode === 'buy' ? 'Max. Win:' : 'Receive:'} <span className="text-green-600 font-bold"><span className="font-normal"><DenariusSymbol size={13} /></span> {payoutDisplay}</span></div>
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
                </>
              )}
              {/* Your Balance Section */}
              <div className="border-t border-gray-200 pt-4 mt-4 hidden lg:block">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Purchased Shares</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-green-600 mb-1">Yes Shares</div>
                    <div className="text-lg font-bold text-gray-800">{isBalanceLoading ? "..." : (outcome1Balance !== '--' && outcome1Balance !== 'Error' ? parseFloat(outcome1Balance).toFixed(2) : outcome1Balance)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-red-600 mb-1">No Shares</div>
                    <div className="text-lg font-bold text-gray-800">{isBalanceLoading ? "..." : (outcome2Balance !== '--' && outcome2Balance !== 'Error' ? parseFloat(outcome2Balance).toFixed(2) : outcome2Balance)}</div>
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
        </div>
      </div>
      
      {/* Sign-in Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-200 pointer-events-auto">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sign In Required</h3>
              <p className="text-sm text-gray-500 mb-6">
                Please sign in to upvote or downvote information
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowSignInModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSignInModal(false);
                    // Scroll to and focus the ConnectButton in the Navbar
                    setTimeout(() => {
                      const connectButton = document.querySelector('[data-testid="connect-button"], button[class*="bg-black"]') as HTMLElement;
                      if (connectButton) {
                        connectButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        connectButton.focus();
                        // Trigger click after a short delay to ensure it's visible
                        setTimeout(() => {
                          connectButton.click();
                        }, 500);
                      }
                    }, 100);
                  }}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}