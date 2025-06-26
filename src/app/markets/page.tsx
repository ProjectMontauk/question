"use client";

import Navbar from "../../../components/Navbar";
import React, { useState, useEffect, useRef } from "react";
import { useActiveAccount, useReadContract, useSendTransaction} from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { tokenContract, marketContract, conditionalTokensContract } from "../../../constants/contracts";
// import { useContract } from "@thirdweb-dev/sdk";
const LmLSMR_CONTRACT_ADDRESS = "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a";
import { formatOdds, formatOddsToCents } from "../../utils/formatOdds";
import { Tab } from "@headlessui/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine, XAxisProps } from 'recharts';
import EvidenceComments from '../../components/EvidenceComments';

// Backend API base URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-url.onrender.com'  // Production URL
  : '';                                       // Development URL - use relative paths

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

const FirstOnlyTick = (props: any) => {
  const { x, y, payload, index } = props;
  if (index !== 0) return null;
  const date = new Date(payload.value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return (
    <g>
      <text x={x} y={y + 16} textAnchor="middle" fill="#666" fontSize={12}>
        {`${month}/${day}`}
      </text>
    </g>
  );
};

function formatBalance(balance: bigint | undefined): string {
  if (!balance) return "--";
  // Divide by 10^18 and show whole numbers only
  return (Number(balance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function MarketsPage() {
  const account = useActiveAccount();
  const { data: balance, isPending } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });
  const { mutate: sendTransaction, status } = useSendTransaction();

  // For Your Balance card - hardcoded PositionIDs
  const [outcome1PositionId] = useState("51877916418744962899164470202259177085298509683534003885170535231097280890835");
  const [outcome2PositionId] = useState("46634212102108699492488813922022044718165605089123703573217419428873160154565");
  const [outcome1Balance, setOutcome1Balance] = useState<string>("--");
  const [outcome2Balance, setOutcome2Balance] = useState<string>("--");
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

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

  const handleApprove = () => {
    if (!account || !balance) return;
    const transaction = prepareContractCall({
      contract: tokenContract,
      method: "function approve(address spender, uint256 value)",
      params: [LmLSMR_CONTRACT_ADDRESS, balance],
    });
    sendTransaction(transaction);
  };

  // Replace individual yesMode and noMode with a single mode state
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');

  // Replace individual yesAmount and noAmount with a single amount state
  const [amount, setAmount] = useState("");

  const [buyFeedback, setBuyFeedback] = useState<string | null>(null);

  // For Buy Yes
  const { mutate: sendBuyYesTransaction, status: buyYesStatus } = useSendTransaction();
  // For Buy No
  const { mutate: sendBuyNoTransaction, status: buyNoStatus } = useSendTransaction();

  const yesIndex = BigInt(0);
  const noIndex = BigInt(1);

  const handleBuyYes = (amount: string) => {
    if (!amount) return;
    const parsedAmount = BigInt(Math.floor(Number(amount) * Math.pow(2, 64)));
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function buy(uint256 _outcome, int128 _amount) returns (int128 _price)",
      params: [yesIndex, parsedAmount],
      gas: 250000n
    });
    sendBuyYesTransaction(transaction, {
      onError: (error) => {
        setBuyFeedback("Purchase failed. Please try again.");
        console.error("Sell transaction error details:", {
          error,
          message: error.message,
          stack: error.stack,
          transaction: transaction
        });
      },
      onSuccess: async (data) => {
        setAmount("");
        setShouldPostOdds(true);
        if (oddsYes !== undefined && !isPendingYes) {
          await fetchOddsHistory();
        }
      },
      onSettled: () => {
        setTimeout(() => setBuyFeedback(null), 4000);
      }
    });
  };

  const handleBuyNo = (amount: string) => {
    if (!amount) return;
    const parsedAmount = BigInt(Math.floor(Number(amount) * Math.pow(2, 64)));
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function buy(uint256 _outcome, int128 _amount) returns (int128 _price)",
      params: [noIndex, parsedAmount],
      gas: 250000n
    });

    sendBuyNoTransaction(transaction, {
      onError: (error) => {
        setBuyFeedback("Purchase failed. Please try again.");
        console.error("Sell transaction error details:", {
          error,
          message: error.message,
          stack: error.stack,
          transaction: transaction
        });
      },
      onSuccess: async (data) => {
        setShouldPostOdds(true);
        if (oddsYes !== undefined && !isPendingYes) {
          await fetchOddsHistory();
        }
      },
      onSettled: () => {
        setTimeout(() => setBuyFeedback(null), 4000);
      }
    });
  };

  // For Sell Yes
  const { mutate: sendSellYesTransaction, status: sellYesStatus } = useSendTransaction();
  // For Sell No
  const { mutate: sendSellNoTransaction, status: sellNoStatus } = useSendTransaction();

  const handleSellYes = (amount: string) => {
    if (!amount) return;
    const parsedAmount = BigInt(Math.floor(Number(amount) * Math.pow(2, 64)));
    const transaction = prepareContractCall({
      contract: marketContract,
      method: "function sell(uint256 _outcome, int128 _amount) returns (int128 _price)",
      params: [yesIndex, parsedAmount],
      gas: 250000n
    });
    sendSellYesTransaction(transaction, {
      onError: (error) => {
        // Add more detailed error logging
        setBuyFeedback("Sale failed. Please try again.");
        console.error("Sell transaction error details:", {
          error,
          message: error.message,
          stack: error.stack,
          transaction: transaction
        });
      },
      onSuccess: async (data) => {
        setShouldPostOdds(true);
        if (oddsYes !== undefined && !isPendingYes) {
          await fetchOddsHistory();
        }
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
      params: [noIndex, parsedAmount],
      gas: 250000n
    });
    sendSellNoTransaction(transaction, {
      onError: (error) => {
        setBuyFeedback("Sell failed. Please try again.");
        console.error("Sell transaction error details:", {
          error,
          message: error.message,
          stack: error.stack,
          transaction: transaction
        });
      },
      onSuccess: async (data) => {
        setShouldPostOdds(true);
        if (oddsYes !== undefined && !isPendingYes) {
          await fetchOddsHistory();
        }
      },
      onSettled: () => {
        setTimeout(() => setBuyFeedback(null), 4000);
      }
    });
  };

  // Evidence data state
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(true);
  const [votingEvidenceId, setVotingEvidenceId] = useState<number | null>(null);
  
  // Track which evidence the user has voted on
  const [userVotes, setUserVotes] = useState<Set<number>>(new Set());

  // Fetch all evidence on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/evidence`)
      .then(res => res.json())
      .then(data => {
        setEvidence(data);
        setLoadingEvidence(false);
      });
  }, []);

  // Fetch user's existing votes to sync state
  const fetchUserVotes = async () => {
    if (!account?.address) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/user-votes?walletAddress=${account.address}`);
      if (res.ok) {
        const userVoteData = await res.json();
        // Assuming the backend returns an array of evidence IDs the user has voted on
        const votedEvidenceIds: Set<number> = new Set(userVoteData.map((vote: any) => Number(vote.evidenceId)));
        setUserVotes(votedEvidenceIds);
      }
    } catch (error) {
      console.error('Failed to fetch user votes:', error);
    }
  };

  // Fetch user votes when account changes
  useEffect(() => {
    if (account?.address) {
      fetchUserVotes();
    } else {
      setUserVotes(new Set());
    }
  }, [account?.address]);

  // State for submit document form
  const [evidenceType, setEvidenceType] = useState<'yes' | 'no'>('yes');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

  // Handle submit document
  const handleSubmitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !url.trim() && !text.trim()) return;
    const newEvidence = {
      type: evidenceType,
      title: title.trim(),
      url: url.trim(),
      description: text.trim(),
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
    setText('');
    setEvidenceType('yes');
  };

  // Handle upvote/downvote toggle
  const handleVote = async (id: number, evidenceType: 'yes' | 'no') => {
    if (!account?.address) return;
    
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
        evidenceType: evidenceType
      };
      
      console.log('Sending vote to backend:', voteData);
      
      const res = await fetch(`${API_BASE_URL}/api/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData),
      });
      
      if (res.ok) {
        // Get the updated evidence with accurate vote counts
        const evidenceRes = await fetch(`${API_BASE_URL}/api/evidence`);
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
        setBuyFeedback(errorMessage);
        setTimeout(() => setBuyFeedback(null), 4000);
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
  const sortedYesEvidence = evidence.filter(ev => ev.type === 'yes').sort((a, b) => b.netVotes - a.netVotes);
  const sortedNoEvidence = evidence.filter(ev => ev.type === 'no').sort((a, b) => b.netVotes - a.netVotes);

  // Odds history state
  const [oddsHistory, setOddsHistory] = useState<OddsHistoryEntry[]>([]);
  const [loadingOdds, setLoadingOdds] = useState(true);

  // Fetch odds history function
  const fetchOddsHistory = async () => {
    const res = await fetch(`${API_BASE_URL}/api/odds-history`);
    const data = await res.json();
    setOddsHistory(Array.isArray(data) ? data : []);
    setLoadingOdds(false);
  };

  // Fetch odds history on mount
  useEffect(() => {
    fetchOddsHistory();
  }, []);

  // Fetch user balances function (with loading state)
  const fetchUserBalances = async () => {
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
    }
    
    setIsBalanceLoading(false);
  };

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
    setIsBalanceLoading(true);
    fetchUserBalances();

    // Set up polling interval (check every 3 seconds) without loading state
    const interval = setInterval(() => {
      // Don't set loading state during polling to prevent blinking
      fetchUserBalancesWithoutLoading();
    }, 3000);

    // Cleanup interval on unmount or account change
    return () => clearInterval(interval);
  }, [account?.address]);

  // Fetch user balances without showing loading state (for polling)
  const fetchUserBalancesWithoutLoading = async () => {
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
      
      // Convert to real token amounts by dividing by 10^18 and remove decimals
      const yesShares = Math.floor(Number(balance1Str) / 1e18).toString();
      const noShares = Math.floor(Number(balance2Str) / 1e18).toString();
      
      setOutcome1Balance(yesShares);
      setOutcome2Balance(noShares);
      
    } catch (err) {
      // Only log errors if wallet is still connected (to avoid spam when disconnecting)
      if (account?.address) {
        console.error("Error fetching user balances:", err);
      }
      // Don't set error state during polling to prevent blinking
    }
  };

  // console.log("oddsHistory", oddsHistory);
  const ODDS_DIVISOR = Number("18446744073709551616");
  // Prepare data for chart: group by timestamp, with yes/no as separate lines
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

  // console.log("chartData", chartData);

  const [shouldPostOdds, setShouldPostOdds] = useState(false);
  const prevOddsRef = useRef<{ yes: bigint | null; no: bigint | null }>({ yes: null, no: null });
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (
      oddsYes !== undefined &&
      oddsNo !== undefined &&
      isInitializedRef.current &&
      (prevOddsRef.current.yes !== oddsYes || prevOddsRef.current.no !== oddsNo)
    ) {
      // POST the new odds
      fetch(`${API_BASE_URL}/api/odds-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yesProbability: Number(oddsYes),
          noProbability: Number(oddsNo),
        }),
      }).then(() => {
        prevOddsRef.current = { yes: oddsYes, no: oddsNo };
        fetchOddsHistory(); // Optionally refresh the chart
      });
    } else if (oddsYes !== undefined && oddsNo !== undefined && !isInitializedRef.current) {
      // Initialize the refs on first load without posting
      prevOddsRef.current = { yes: oddsYes, no: oddsNo };
      isInitializedRef.current = true;
    }
  }, [oddsYes, oddsNo]);

  // Add state for selected outcome
  const [selectedOutcome, setSelectedOutcome] = useState<'yes' | 'no' | null>(null);

  // Manual price calculation state
  const [priceResult, setPriceResult] = useState<bigint | undefined>(undefined);
  const [isPricePending, setIsPricePending] = useState(false);
  const [priceError, setPriceError] = useState<Error | null>(null);

  // Auto-calculate price when both outcome and amount are available
  useEffect(() => {
    if (selectedOutcome && amount && parseFloat(amount) > 0) {
      const outcome = selectedOutcome === 'yes' ? 1 : 2;
      const amountValue = parseFloat(amount);
      
      if (!isNaN(amountValue) && amountValue > 0) {
        handleAutoGetPrice(outcome, amountValue);
      }
    }
  }, [selectedOutcome, amount]);

  // Handle automatic price calculation
  const handleAutoGetPrice = async (outcome: number, amount: number) => {
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
  };

  // Handle manual Get Price button click
  const handleGetPrice = async () => {
    if (selectedOutcome && amount && parseFloat(amount) > 0) {
      const outcome = selectedOutcome === 'yes' ? 1 : 2;
      const amountValue = parseFloat(amount);
      
      if (!isNaN(amountValue) && amountValue > 0) {
        handleAutoGetPrice(outcome, amountValue);
      }
    }
  };

  // Calculate payout
  let payoutDisplay = '--';
  if (selectedOutcome && amount && !isNaN(Number(amount)) && Number(amount) > 0) {
    let odds = selectedOutcome === 'yes' ? oddsYes : oddsNo;
    if (typeof odds === 'bigint' || typeof odds === 'number') {
      const oddsNum = Number(odds) / ODDS_DIVISOR;
      // Payout = amount * (1/odds) for buy, or amount * odds for sell (simplified, adjust as needed)
      // For prediction markets, usually payout = amount * (1/odds) for buy, amount * odds for sell
      let payout = 0;
      if (mode === 'buy') {
        payout = Number(amount) / oddsNum;
      } else {
        payout = Number(amount) * oddsNum;
      }
      if (isFinite(payout)) {
        payoutDisplay = `$${payout.toFixed(2)}`;
      }
    }
  }

  // Calculate user's voting weight for display
  const getUserVotingWeight = (evidenceType: 'yes' | 'no') => {
    const yesShares = parseInt(outcome1Balance) || 0;
    const noShares = parseInt(outcome2Balance) || 0;
    
    if (evidenceType === 'yes') {
      // Only boosted voting power if Yes shares > No shares
      if (yesShares > noShares) {
        return Math.max(1, yesShares - noShares);
      } else {
        return 1; // Base weight if No shares >= Yes shares
      }
    } else {
      // Only boosted voting power if No shares > Yes shares
      if (noShares > yesShares) {
        return Math.max(1, noShares - yesShares);
      } else {
        return 1; // Base weight if Yes shares >= No shares
      }
    }
  };

  // Get user's voting contribution for a specific evidence piece
  const getUserVotingContribution = (evidenceId: number, evidenceType: 'yes' | 'no') => {
    if (!userVotes.has(evidenceId)) {
      return 0; // User hasn't voted on this evidence
    }
    
    // Calculate current voting weight based on current balances
    const yesShares = parseInt(outcome1Balance) || 0;
    const noShares = parseInt(outcome2Balance) || 0;
    
    if (evidenceType === 'yes') {
      if (yesShares > noShares) {
        return Math.max(1, yesShares - noShares);
      } else {
        return 1;
      }
    } else {
      if (noShares > yesShares) {
        return Math.max(1, noShares - yesShares);
      } else {
        return 1;
      }
    }
  };

  // Function to update user position in database
  const updateUserPosition = async (yesShares: string, noShares: string) => {
    if (!account?.address) return;
    
    try {
      await fetch('/api/update-user-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: account.address,
          yesShares: parseInt(yesShares) || 0,
          noShares: parseInt(noShares) || 0
        }),
      });
      
      // Refresh evidence data to show updated vote counts
      const evidenceRes = await fetch(`${API_BASE_URL}/api/evidence`);
      if (evidenceRes.ok) {
        const updatedEvidence = await evidenceRes.json();
        setEvidence(updatedEvidence);
      }
    } catch (error) {
      console.error('Failed to update user position:', error);
    }
  };

  // Update user position when balances change
  useEffect(() => {
    if (outcome1Balance !== "--" && outcome2Balance !== "--" && !isBalanceLoading) {
      updateUserPosition(outcome1Balance, outcome2Balance);
    }
  }, [outcome1Balance, outcome2Balance, isBalanceLoading, account?.address]);

  // Add state to track which evidence card is expanded
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<number | null>(null);

  // Add state for view more/less
  const [showAllYes, setShowAllYes] = useState(false);
  const [showAllNo, setShowAllNo] = useState(false);

  // In the Yes Documents Tab
  const yesToShow = showAllYes ? sortedYesEvidence : sortedYesEvidence.slice(0, 5);

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center pt-8 w-full">
        {/* Responsive flex row for chart and betting card */}
        <div className="flex flex-col lg:flex-row justify-between items-start w-full max-w-7xl mx-auto mb-10 gap-2">
          {/* Odds History Chart Card */}
          <div className="bg-white rounded-xl shadow border border-gray-200 p-8 max-w-4xl w-full mb-8 lg:mb-0 ml-auto">
            <h2 className="text-2xl font-bold mb-6 text-[#171A22]">Did the CIA aid in the planning or execution of John F. Kennedy's Assassination?</h2>
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
                        const [year, month, day] = chartData[0].timestamp.split('-');
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
            <div className="flex items-center mb-4">
              <div className="flex gap-2 mr-6">
                <button
                  className={`px-4 py-1 rounded-l-lg font-medium text-sm border ${mode === 'buy' ? 'bg-black text-white border-black' : 'bg-white text-black border-black'}`}
                  onClick={() => setMode('buy')}
                  type="button"
                >
                  Buy
                </button>
                <button
                  className={`px-4 py-1 rounded-r-lg font-medium text-sm border ${mode === 'sell' ? 'bg-black text-white border-black' : 'bg-white text-black border-black'}`}
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
              type="number"
              min="0"
              placeholder={`Enter ${mode === 'buy' ? 'Buy' : 'Sell'} Amount`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
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
                  : (sellYesStatus === 'pending' ? 'Selling...' : `Yes ${formatOddsToCents(oddsYes)}`)}
              </button>
              <button
                type="button"
                className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-red-600 hover:bg-red-700 text-white w-1/2 ${selectedOutcome === 'no' ? 'ring-2 ring-black' : ''}`}
                onClick={() => setSelectedOutcome('no')}
              >
                {mode === 'buy'
                  ? (buyNoStatus === 'pending' ? 'Buying...' : `No ${formatOddsToCents(oddsNo)}`)
                  : (sellNoStatus === 'pending' ? 'Selling...' : `No ${formatOddsToCents(oddsNo)}`)}
              </button>
            </div>
            {/* Max. Win/Receive sub-title */}
            <div className="text-[1.15rem] font-medium text-black mb-4">{mode === 'buy' ? 'Max. Win:' : 'Receive:'} <span className="text-green-600 font-bold">{payoutDisplay}</span></div>
            {/* Trade button */}
            <button
              className="w-full font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 bg-black text-white mb-4"
              disabled={!selectedOutcome || !amount || (selectedOutcome === 'yes' && (mode === 'buy' ? buyYesStatus === 'pending' : sellYesStatus === 'pending')) || (selectedOutcome === 'no' && (mode === 'buy' ? buyNoStatus === 'pending' : sellNoStatus === 'pending'))}
              onClick={() => {
                if (!selectedOutcome || !amount) return;
                if (selectedOutcome === 'yes') {
                  mode === 'buy' ? handleBuyYes(amount) : handleSellYes(amount);
                } else if (selectedOutcome === 'no') {
                  mode === 'buy' ? handleBuyNo(amount) : handleSellNo(amount);
                }
              }}
            >
              Trade
            </button>
            <div className="text-left text-sm text-gray-600 mb-4">
              Avg. Price
              {priceResult !== undefined && !isPricePending && !priceError && (
                <span className="ml-2 text-sm text-gray-600">
                  ¢{(((Number(priceResult) / Math.pow(2, 64)) / parseFloat(amount)) * 100).toFixed(0)}
                </span>
              )}
            </div>
            {buyFeedback && (
              <div className={`text-center my-4 ${buyFeedback.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{buyFeedback}</div>
            )}
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
          </div>
        </div>
        {/* Evidence Section Card */}
        <div className="max-w-7xl w-full mx-auto flex">
          <div className="bg-white rounded-xl shadow border border-gray-200 p-8 max-w-4xl w-full ml-19">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#171A22]">Evidence</h2>
              {account?.address && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Voting Power:</span>
                  <span className="ml-2 text-green-600 font-semibold">Yes: {getUserVotingWeight('yes')}x</span>
                  <span className="ml-2 text-red-600 font-semibold">No: {getUserVotingWeight('no')}x</span>
                  <div className="text-xs text-gray-500 mt-1">
                    Full power applied to each piece of evidence you vote on
                  </div>
                </div>
              )}
            </div>
            <Tab.Group>
              <Tab.List className="flex w-full mb-6 bg-gray-50 rounded-lg">
                <Tab
                  className={({ selected }: { selected: boolean }) =>
                    `flex-1 px-6 py-2 rounded-lg font-medium text-sm transition focus:outline-none ${selected ? "bg-white text-[#171A22] shadow" : "bg-gray-50 text-gray-500"}`
                  }
                >
                  View "Yes" Documents
                </Tab>
                <Tab
                  className={({ selected }: { selected: boolean }) =>
                    `flex-1 px-6 py-2 rounded-lg font-medium text-sm transition focus:outline-none ${selected ? "bg-white text-[#171A22] shadow" : "bg-gray-50 text-gray-500"}`
                  }
                >
                  View "No" Documents
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
                          className="mb-6 border rounded-lg p-6 bg-white shadow-sm border-gray-200"
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
                              </div>
                              <div className="text-gray-600 text-sm line-clamp-2">{evidence.description}</div>
                              <button
                                className="text-xs text-gray-600 mt-0.5 hover:underline hover:text-blue-800 focus:outline-none"
                                type="button"
                                onClick={() => setExpandedEvidenceId(expandedEvidenceId === evidence.id ? null : evidence.id)}
                              >
                                {expandedEvidenceId === evidence.id ? 'Hide Replies' : 'View Replies'}
                              </button>
                              {/* Show comments section if expanded */}
                              {expandedEvidenceId === evidence.id && (
                                <EvidenceComments
                                  evidence={{ ...evidence, commentCount: evidence.commentCount ?? 0 }}
                                  currentUserAddress={account?.address}
                                  onClose={() => setExpandedEvidenceId(null)}
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
                          className="mb-6 border rounded-lg p-6 bg-white shadow-sm border-gray-200"
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
                              </div>
                              <div className="text-gray-600 text-sm line-clamp-2">{evidence.description}</div>
                              <button
                                className="text-xs text-gray-600 mt-0.5 hover:underline hover:text-blue-800 focus:outline-none"
                                type="button"
                                onClick={() => setExpandedEvidenceId(expandedEvidenceId === evidence.id ? null : evidence.id)}
                              >
                                {expandedEvidenceId === evidence.id ? 'Hide Replies' : 'View Replies'}
                              </button>
                              {/* Show comments section if expanded */}
                              {expandedEvidenceId === evidence.id && (
                                <EvidenceComments
                                  evidence={{ ...evidence, commentCount: evidence.commentCount ?? 0 }}
                                  currentUserAddress={account?.address}
                                  onClose={() => setExpandedEvidenceId(null)}
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
                    <div>
                      <label className="block font-medium text-gray-700 mb-2 text-[95%]">Text</label>
                      <textarea
                        placeholder="Enter the document text or analysis..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base min-h-[60px] placeholder:text-[95%]"
                      />
                    </div>
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