'use client';

import { useState, useEffect, useCallback } from "react";
import { Tab } from "@headlessui/react";
import { useRouter } from "next/navigation";
import { useActiveAccount} from "thirdweb/react";
import Navbar from "../../../components/Navbar";

type AnswerMap = Record<string, string>;

export default function SurveyPage() {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evidence section state and functions (copied from JFK market page)
  const router = useRouter();
  const account = useActiveAccount();
  const [evidence, setEvidence] = useState<Array<{id: number; type: string; title: string; url?: string; netVotes: number}>>([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Set<number>>(new Set());
  const [votingEvidenceId, setVotingEvidenceId] = useState<number | null>(null);
  const [showAllYes, setShowAllYes] = useState(false);
  const [showAllNo, setShowAllNo] = useState(false);
  const [yesVotingPower] = useState(0);
  const [noVotingPower] = useState(0);

  // JFK market data
  const market = {
    id: 'jfk',
    title: "CIA Involved in JFK Assassination?",
    outcomes: ["Yes, CIA involved in JFK&apos;s death", "No, CIA innocent in JFK&apos;s death"]
  };

  // Helper functions
  const isPdfUrl = (url: string) => url.toLowerCase().includes('.pdf');
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'link';
    }
  };

  const getUserVotingContribution = () => {
    // Simplified - return 1 for demo
    return 1;
  };

  
  const handleVote = async (evidenceId: number, type: string) => {
    if (!account?.address) return;
    
    setVotingEvidenceId(evidenceId);
    try {
      const response = await fetch('/api/evidence-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceId,
          type,
          walletAddress: account.address
        })
      });
      
      if (response.ok) {
        // Toggle vote in UI
        setUserVotes(prev => {
          const newVotes = new Set(prev);
          if (newVotes.has(evidenceId)) {
            newVotes.delete(evidenceId);
          } else {
            newVotes.add(evidenceId);
          }
          return newVotes;
        });
        // Refresh evidence data
        fetchEvidence();
      }
    } catch (error) {
      console.error('Vote failed:', error);
    } finally {
      setVotingEvidenceId(null);
    }
  };

  const fetchEvidence = useCallback(async () => {
    try {
      const response = await fetch('/api/evidence?marketId=jfk');
      if (response.ok) {
        const data = await response.json() as Array<{id: number; type: string; title: string; url?: string; netVotes: number}>;
        setEvidence(data);
      }
    } catch (error) {
      console.error('Failed to fetch evidence:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  // Process evidence data
  const sortedYesEvidence = evidence.filter(e => e.type === 'yes').sort((a, b) => b.netVotes - a.netVotes);
  const sortedNoEvidence = evidence.filter(e => e.type === 'no').sort((a, b) => b.netVotes - a.netVotes);
  const yesToShow = showAllYes ? sortedYesEvidence : sortedYesEvidence.slice(0, 5);
  const noToShow = showAllNo ? sortedNoEvidence : sortedNoEvidence.slice(0, 5);

  const updateAnswer = (key: string, value: string) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const submitSurvey = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit survey");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div>
        <Navbar />
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-green-800 mb-2">Thank you!</h2>
            <p className="text-green-700">Your survey responses have been recorded.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-6">Survey</h1>
        
        <form className="space-y-8">
          {/* Name Field */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Name
            </label>
            <input
              type="text"
              value={answers.name || ""}
              onChange={(e) => updateAnswer("name", e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* Question 1 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              How would you describe yourself as a Polymarket user?
            </label>
            <div className="space-y-2">
              {[
                "Political Junkie",
                "Quant - looking for an edge", 
                "Gambler",
                "Passive Viewer that enjoys the information produced"
              ].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`userType_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`userType_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* JFK Market Card */}
          <div className="bg-white rounded-xl shadow border border-gray-200 p-5 w-full mb-6">
            <div className="mb-4">
              <img
                src="/JFKCar.png"
                alt="CIA Involved in JFK Assassination?"
                className="w-full h-48 rounded-lg object-cover object-top"
              />
            </div>
            <div className="mb-3">
              <h3 className="text-xl font-bold text-gray-900">CIA Involved in JFK Assassination?</h3>
            </div>
            <div className="mb-0">
              <div className="grid grid-cols-4 gap-2 items-center">
                <div className="text-sm font-semibold text-black col-span-3">Yes, CIA involved in JFK&apos;s death:</div>
                <div className="text-lg font-bold text-green-600 text-right bg-green-100 rounded pr-7 px-1">
                  60%
                </div>
                <div className="text-sm font-semibold text-black col-span-3">No, CIA innocent in JFK&apos;s death:</div>
                <div className="text-lg font-bold text-red-600 text-right bg-red-100 rounded pr-7 px-1">
                  40%
                </div>
              </div>
            </div>
          </div>

          {/* Question 2 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Are you interested in seeing a market created on any of the following topics?
            </label>
            <div className="space-y-2">
              {[
                "CIA Involved in JFK Assassination?",
                "Is the Apollo 11 Moon Landing Fake?",
                "Bridgitte Macron born a man?",
                "Childhood Vaccines Linked to Autism?",
                "Is Trump an Epstein-Pedophile?",
                "mRNA Vax Linked to Cancer?",
                "mRNA Vax Linked to Fertility Decline?",
                "Is Jeffrey Epstein an Asset of US/Israeli Intelligence?"
              ].map((topic) => (
                <label key={topic} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`topic_${topic}`] === "true"}
                    onChange={(e) => updateAnswer(`topic_${topic}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{topic}</span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Other topics you would be interested in?
              </label>
              <textarea
                value={answers.otherTopics || ""}
                onChange={(e) => updateAnswer("otherTopics", e.target.value)}
                placeholder="Please describe any other topics you&apos;d like to see markets for..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          </div>

          {/* Question 3 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Would you wager on a market given you felt like there was an independent commission of experts who would review the evidence and make an accurate decision?
            </label>
            <div className="space-y-2">
              {["Yes", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`expertCommission_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`expertCommission_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 4 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Which market resolution method would you prefer?
            </label>
            <div className="space-y-2">
              {[
                "No market resolution - fully liquid market where you could buy/sell based on market prices forever - let the market decide price forever?",
                "Market resolution once \"overwhelming evidence is established\" - a panel of independent experts would be called to make a judgement after it was deemed there was enough evidence to prove \"beyond a reasonable doubt\" that one side was true?",
                "Market resolution after a certain time frame - a panel of independent experts would be called to make a judgement after a one-year or six-month discovery period is over."
              ].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`resolutionMethod_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`resolutionMethod_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 5 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              If the experts failed to find conclusive evidence for either side, what actions would you like to see happen next?
            </label>
            <div className="space-y-2">
              {[
                "Freeze current market odds and redeem at the market price. If the market says 85% yes, yes share holders redeem at 85%?",
                "Return everybody&apos;s money still in the market regardless of current prices",
                "Allow the market to continue running until there was another trial called to settle the market!"
              ].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`inconclusiveEvidence_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`inconclusiveEvidence_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Evidence Section */}
          <div className="pt-8 border-t-2 border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Evidence Section</h2>
            
            {/* JFK Market Evidence Section - Exact copy from market page */}
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
                    {loading ? (
                      <div className="text-gray-500 text-sm">Loading evidence...</div>
                    ) : sortedYesEvidence.length === 0 ? (
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
                                    {userVotes.has(evidence.id) ? `+${getUserVotingContribution()}` : <span className="opacity-0">+0</span>}
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
                    {loading ? (
                      <div className="text-gray-500 text-sm">Loading evidence...</div>
                    ) : sortedNoEvidence.length === 0 ? (
                      <div className="text-gray-500 text-sm">No evidence submitted yet.</div>
                    ) : (
                      <>
                        {noToShow.map((evidence, idx) => (
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
                                    {userVotes.has(evidence.id) ? `+${getUserVotingContribution()}` : <span className="opacity-0">+0</span>}
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
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-sm">Submit document functionality would go here.</p>
                    </div>
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
          </div>

          {/* Question 6 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Would you view the information in the evidence section before making a bet?
            </label>
            <div className="space-y-2">
              {["Yes", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`viewMarketInfo_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`viewMarketInfo_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 7 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Would you contribute to the information section of the market by commenting, upvoting evidence, or submitting evidence?
            </label>
            <div className="space-y-2">
              {["Yes", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`contributeInfo_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`contributeInfo_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 8 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              On a scale of 1-10, how much would you trust the evidence section considering only the people who bet on that position are able to contribute?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => (
                <label key={rating} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="trustEvidence"
                    value={rating.toString()}
                    checked={answers.trustEvidence === rating.toString()}
                    onChange={(e) => updateAnswer("trustEvidence", e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700 text-sm">{rating}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>1 - Not at all</span>
              <span>10 - Completely</span>
            </div>
          </div>

          {/* Question 9 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Would you be interested in watching a televised trial where the two sides of the debate presented the information in the evidence section publicly and cross-examined each other?
            </label>
            <div className="space-y-2">
              {["Yes", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`televisedTrial_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`televisedTrial_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 10 */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Would you be interested in reading the outcomes of the case where the experts review the available information in the evidence section and publish a report?
            </label>
            <div className="space-y-2">
              {["Yes", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`expertReport_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`expertReport_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 11 - Final Question */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              What class of experts would you find the most independent and able to make an independent decision?
            </label>
            <div className="space-y-2">
              {[
                "Professors of History or Science at Elite Institutions - Stanford, Harvard, UPenn, etc",
                "Professors of History or Science at Big Research Universities - Iowa, Florida, Nebraska, or Montana",
                "Professors of History or Science at Military Colleges - West Point, Air Force, The Citadel, etc",
                "European Professors of History or Science at Respected Institutions",
                "Practitioners - Doctors for medical questions & Published Historians for historical questions",
                "Jury of Peers - draft random users given they are college educated and employed",
                "Amish People",
                "A Bi-Partisan Congressional Committee",
                "Celebrities"
              ].map((option) => (
                <label key={option} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[`expertClass_${option}`] === "true"}
                    onChange={(e) => updateAnswer(`expertClass_${option}`, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Open-ended Comments Section */}
          <div className="space-y-3">
            <label className="block text-lg font-medium text-gray-900">
              Additional Comments
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Please share any additional thoughts, suggestions, or feedback about the survey or prediction markets in general.
            </p>
            <textarea
              value={answers.additionalComments || ""}
              onChange={(e) => updateAnswer("additionalComments", e.target.value)}
              placeholder="Share your thoughts here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-6 border-t">
            <button
              type="button"
              onClick={submitSurvey}
              disabled={submitting}
              className="w-full px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Survey"}
            </button>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}



