"use client";

import Navbar from "../../../components/Navbar";
import React, { useState, useEffect, useRef } from "react";
import { useActiveAccount, useReadContract, useSendTransaction} from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { tokenContract, marketContract } from "../../../constants/contracts";
// import { useContract } from "@thirdweb-dev/sdk";
const LmLSMR_CONTRACT_ADDRESS = "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a";
import { formatOdds } from "../../utils/formatOdds";
import { Tab } from "@headlessui/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

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
}

// Add OddsHistoryEntry type
interface OddsHistoryEntry {
  id: number;
  yesProbability: number;
  noProbability: number;
  timestamp: string;
}

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

  // Replace individual yesMode and noMode with a single mode state
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');

  const [yesAmount, setYesAmount] = useState("");
  const [noAmount, setNoAmount] = useState("");

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
      gas: 150000n
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
        setBuyFeedback("Purchase successful!");
        setYesAmount("");
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
      gas: 150000n
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
        if (oddsYes !== undefined && !isPendingYes) {
          setShouldPostOdds(true);
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
      gas: 150000n
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
        if (oddsYes !== undefined && !isPendingYes) {
          setShouldPostOdds(true);
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
      gas: 150000n
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
        if (oddsYes !== undefined && !isPendingYes) {
          setShouldPostOdds(true);
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

  // Fetch all evidence on mount
  useEffect(() => {
    fetch('/api/evidence')
      .then(res => res.json())
      .then(data => {
        setEvidence(data);
        setLoadingEvidence(false);
      });
  }, []);

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
    const res = await fetch('/api/evidence', {
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

  // Handle upvote/downvote
  const handleVote = async (id: number, netVotes: number) => {
    const res = await fetch('/api/evidence', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, netVotes }),
    });
    const updated = await res.json();
    setEvidence(prev => prev.map(ev => ev.id === id ? { ...ev, netVotes: updated.netVotes } : ev));
  };

  // Filter and sort evidence for Yes/No tabs
  const sortedYesEvidence = evidence.filter(ev => ev.type === 'yes').sort((a, b) => b.netVotes - a.netVotes);
  const sortedNoEvidence = evidence.filter(ev => ev.type === 'no').sort((a, b) => b.netVotes - a.netVotes);

  // Odds history state
  const [oddsHistory, setOddsHistory] = useState<OddsHistoryEntry[]>([]);
  const [loadingOdds, setLoadingOdds] = useState(true);

  // Fetch odds history function
  const fetchOddsHistory = async () => {
    const res = await fetch('/api/odds-history');
    const data = await res.json();
    setOddsHistory(Array.isArray(data) ? data : []);
    setLoadingOdds(false);
  };

  // Fetch odds history on mount
  useEffect(() => {
    fetchOddsHistory();
  }, []);

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

  useEffect(() => {
    if (
      shouldPostOdds &&
      oddsYes !== undefined &&
      oddsNo !== undefined &&
      (prevOddsRef.current.yes !== oddsYes || prevOddsRef.current.no !== oddsNo)
    ) {
      // POST the new odds
      fetch('/api/odds-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yesProbability: Number(oddsYes),
          noProbability: Number(oddsNo),
        }),
      }).then(() => {
        setShouldPostOdds(false);
        prevOddsRef.current = { yes: oddsYes, no: oddsNo };
        fetchOddsHistory(); // Optionally refresh the chart
      });
    }
  }, [shouldPostOdds, oddsYes, oddsNo]);

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center pt-8 w-full">
        {/* Odds History Chart Card */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-8 max-w-5xl w-full mx-auto mb-10">
          <h2 className="text-2xl font-bold mb-6 text-[#171A22]">Did the CIA aid in the planning or execution of John F. Kennedy's Assassination?</h2>
          <div className="mb-2">
            <span className="text-lg font-semibold text-[#171A22]">Market Odds</span>
          </div>
          {loadingOdds ? (
            <div className="text-gray-500">Loading chart...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 12, dy: 8 }}
                  height={40}
                  tickFormatter={(_, index) => {
                    if (index === 0) {
                      const date = new Date(chartData[0].timestamp);
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      return `${month}-${day}`;
                    }
                    return "";
                  }}
                  padding={{ left: 0, right: 0 }}
                  minTickGap={0}
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
        </div>
        {/* Prediction Market Card */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-8 flex flex-col min-h-[500px] max-w-5xl w-full mx-auto mb-10">
          {/* Align toggle and question in a flex row */}
          <div className="flex items-center mb-4">
            <div className="flex gap-2 mr-6">
              <button
                className={`px-4 py-1 rounded-l-lg font-medium text-sm border ${mode === 'buy' ? 'bg-green-600 text-white' : 'bg-white text-green-600 border-green-600'}`}
                onClick={() => setMode('buy')}
                type="button"
              >
                Buy
              </button>
              <button
                className={`px-4 py-1 rounded-r-lg font-medium text-sm border ${mode === 'sell' ? 'bg-red-600 text-white' : 'bg-white text-red-600 border-red-600'}`}
                onClick={() => setMode('sell')}
                type="button"
              >
                Sell
              </button>
            </div>
          </div>
          {/* Odds boxes section */}
          <div className="flex justify-center items-center gap-8 my-6">
            {/* Yes Position Card */}
            <div className="bg-[#f8f9fa] border border-gray-300 rounded-lg px-10 py-6 flex flex-col items-center min-w-[170px]">
              <span className="text-lg font-semibold text-[#171A22] mb-2">Yes</span>
              <span className="text-2xl font-bold text-[#171A22]">{isPendingYes ? "..." : formatOdds(oddsYes)}</span>
              <div className="flex items-center gap-2 w-full mt-4">
                <input
                  type="number"
                  min="0"
                  placeholder={`Enter ${mode === 'buy' ? 'Buy' : 'Sell'} Amount`}
                  value={yesAmount}
                  onChange={e => setYesAmount(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-base"
                />
                <button
                  className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 ${mode === 'buy' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-white border border-green-600 text-green-700'}`}
                  onClick={() => mode === 'buy' ? handleBuyYes(yesAmount) : handleSellYes(yesAmount)}
                  disabled={!yesAmount || (mode === 'buy' ? buyYesStatus === 'pending' : sellYesStatus === 'pending')}
                >
                  {mode === 'buy'
                    ? (buyYesStatus === 'pending' ? 'Buying...' : 'Buy Yes')
                    : (sellYesStatus === 'pending' ? 'Selling...' : 'Sell Yes')}
                </button>
              </div>
            </div>
            {/* No Position Card */}
            <div className="bg-[#f8f9fa] border border-gray-300 rounded-lg px-10 py-6 flex flex-col items-center min-w-[170px]">
              <span className="text-lg font-semibold text-[#171A22] mb-2">No</span>
              <span className="text-2xl font-bold text-[#171A22]">{isPendingNo ? "..." : formatOdds(oddsNo)}</span>
              <div className="flex items-center gap-2 w-full mt-4">
                <input
                  type="number"
                  min="0"
                  placeholder={`Enter ${mode === 'buy' ? 'Buy' : 'Sell'} Amount`}
                  value={noAmount}
                  onChange={e => setNoAmount(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                />
                <button
                  className={`font-semibold px-6 py-2 rounded-lg shadow transition disabled:opacity-50 ${mode === 'buy' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white border border-red-600 text-red-700'}`}
                  onClick={() => mode === 'buy' ? handleBuyNo(noAmount) : handleSellNo(noAmount)}
                  disabled={!noAmount || (mode === 'buy' ? buyNoStatus === 'pending' : sellNoStatus === 'pending')}
                >
                  {mode === 'buy'
                    ? (buyNoStatus === 'pending' ? 'Buying...' : 'Buy No')
                    : (sellNoStatus === 'pending' ? 'Selling...' : 'Sell No')}
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

        {/* Evidence Section Card */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-8 max-w-5xl w-full mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-[#171A22]">Evidence</h2>
          <Tab.Group>
            <Tab.List className="flex space-x-2 mb-6">
              <Tab
                className={({ selected }: { selected: boolean }) =>
                  `px-6 py-2 rounded-lg font-medium text-sm transition focus:outline-none ${selected ? "bg-gray-100 text-[#171A22]" : "bg-white text-gray-500 border border-gray-200"}`
                }
              >
                View "Yes" Documents
              </Tab>
              <Tab
                className={({ selected }: { selected: boolean }) =>
                  `px-6 py-2 rounded-lg font-medium text-sm transition focus:outline-none ${selected ? "bg-gray-100 text-[#171A22]" : "bg-white text-gray-500 border border-gray-200"}`
                }
              >
                View "No" Documents
              </Tab>
              <Tab
                className={({ selected }: { selected: boolean }) =>
                  `px-6 py-2 rounded-lg font-medium text-sm transition focus:outline-none ${selected ? "bg-gray-100 text-[#171A22]" : "bg-white text-gray-500 border border-gray-200"}`
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
                  sortedYesEvidence.map((evidence, idx) => (
                    <div
                      key={evidence.id}
                      className="mb-6 border rounded-lg p-6 bg-white shadow-sm border-gray-200"
                    >
                      <div className="flex">
                        {/* Voting column */}
                        <div className="flex flex-col items-center mr-4 select-none">
                          <button
                            className="text-green-600 hover:text-green-800 text-base p-0 mb-1"
                            onClick={() => handleVote(evidence.id, evidence.netVotes + 1)}
                            aria-label="Upvote"
                            type="button"
                          >
                            <span style={{fontSize: '1.01em'}}>↑</span>
                          </button>
                          <div className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs font-semibold mb-1" style={{minWidth: '1.48rem', textAlign: 'center'}}>
                            {evidence.netVotes}
                          </div>
                          <button
                            className="text-red-600 hover:text-red-800 text-base p-0"
                            onClick={() => handleVote(evidence.id, evidence.netVotes - 1)}
                            aria-label="Downvote"
                            type="button"
                          >
                            <span style={{fontSize: '1.01em'}}>↓</span>
                          </button>
                        </div>
                        {/* Evidence content */}
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="text-lg font-semibold mr-2">#{idx + 1}</span>
                            {evidence.url ? (
                              <a
                                href={evidence.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lg font-bold text-[#171A22] hover:underline"
                              >
                                {evidence.title} ({getDomain(evidence.url)})
                              </a>
                            ) : (
                              <span className="text-lg font-bold text-[#171A22]">{evidence.title}</span>
                            )}
                          </div>
                          <div className="text-gray-600 mb-2">{evidence.description}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </Tab.Panel>
              {/* No Documents Tab */}
              <Tab.Panel>
                {sortedNoEvidence.length === 0 ? (
                  <div className="text-gray-500">No evidence submitted yet.</div>
                ) : (
                  sortedNoEvidence.map((evidence, idx) => (
                    <div
                      key={evidence.id}
                      className="mb-6 border rounded-lg p-6 bg-white shadow-sm border-gray-200"
                    >
                      <div className="flex">
                        {/* Voting column */}
                        <div className="flex flex-col items-center mr-4 select-none">
                          <button
                            className="text-green-600 hover:text-green-800 text-base p-0 mb-1"
                            onClick={() => handleVote(evidence.id, evidence.netVotes + 1)}
                            aria-label="Upvote"
                            type="button"
                          >
                            <span style={{fontSize: '1.01em'}}>↑</span>
                          </button>
                          <div className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs font-semibold mb-1" style={{minWidth: '1.48rem', textAlign: 'center'}}>
                            {evidence.netVotes}
                          </div>
                          <button
                            className="text-red-600 hover:text-red-800 text-base p-0"
                            onClick={() => handleVote(evidence.id, evidence.netVotes - 1)}
                            aria-label="Downvote"
                            type="button"
                          >
                            <span style={{fontSize: '1.01em'}}>↓</span>
                          </button>
                        </div>
                        {/* Evidence content */}
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="text-lg font-semibold mr-2">#{idx + 1}</span>
                            {evidence.url ? (
                              <a
                                href={evidence.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lg font-bold text-[#171A22] hover:underline"
                              >
                                {evidence.title} ({getDomain(evidence.url)})
                              </a>
                            ) : (
                              <span className="text-lg font-bold text-[#171A22]">{evidence.title}</span>
                            )}
                          </div>
                          <div className="text-gray-600 mb-2">{evidence.description}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </Tab.Panel>
              {/* Submit Document Tab */}
              <Tab.Panel>
                <form className="space-y-6 max-w-2xl mx-auto" onSubmit={handleSubmitDocument}>
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Evidence Type</label>
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
                    <label className="block font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      placeholder="e.g., CIA Memo dated Sept 1963"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">URL</label>
                    <input
                      type="text"
                      placeholder="Enter the URL of the document..."
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Text</label>
                    <textarea
                      placeholder="Enter the document text or analysis..."
                      value={text}
                      onChange={e => setText(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base min-h-[100px]"
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
  );
} 