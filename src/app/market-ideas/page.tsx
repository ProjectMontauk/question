"use client";

import Navbar from "../../../components/Navbar";
import React, { useState, useEffect, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";

// Backend API base URL - use Next.js API routes for both dev and production
const API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://tacoshell.vercel.app' : '';

// Define MarketIdea type
interface MarketIdea {
  id: number;
  title: string;
  description: string;
  rules: string;
  netVotes: number;
  walletAddress: string;
  createdAt?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function MarketIdeasPage() {
  const account = useActiveAccount();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'proposed' | 'submit'>('proposed');
  // State for market ideas
  const [marketIdeas, setMarketIdeas] = useState<MarketIdea[]>([]);
  const [votingIdeaId, setVotingIdeaId] = useState<number | null>(null);
  const [userVotes, setUserVotes] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // Form state for new market idea
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // Fetch market ideas
  const fetchMarketIdeas = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/market-ideas`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMarketIdeas(data);
        } else {
          console.error('Market ideas data is not an array:', data);
          setMarketIdeas([]);
        }
      } else {
        console.error('Failed to fetch market ideas:', res.status);
        setMarketIdeas([]);
      }
    } catch (error) {
      console.error('Error fetching market ideas:', error);
      setMarketIdeas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user's existing votes
  const fetchUserVotes = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/market-idea-votes?walletAddress=${account.address}`);
      if (res.ok) {
        const userVoteData = await res.json();
        const votedIdeaIds: Set<number> = new Set(userVoteData.map((vote: { ideaId: number }) => Number(vote.ideaId)));
        setUserVotes(votedIdeaIds);
      }
    } catch (error) {
      console.error('Failed to fetch user votes:', error);
    }
  }, [account?.address]);

  // Fetch data on mount
  useEffect(() => {
    fetchMarketIdeas();
  }, [fetchMarketIdeas]);

  useEffect(() => {
    if (account?.address) {
      fetchUserVotes();
    }
  }, [account?.address, fetchUserVotes]);

  // Handle vote toggle
  const handleVote = async (ideaId: number) => {
    if (!account?.address) return;
    
    setVotingIdeaId(ideaId);
    
    const hasVoted = userVotes.has(ideaId);
    
    // Optimistic update
    const optimisticIdeas = marketIdeas.map(idea => {
      if (idea.id === ideaId) {
        return {
          ...idea,
          netVotes: hasVoted ? idea.netVotes - 1 : idea.netVotes + 1
        };
      }
      return idea;
    });
    
    setMarketIdeas(optimisticIdeas);
    
    if (hasVoted) {
      setUserVotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(ideaId);
        return newSet;
      });
    } else {
      setUserVotes(prev => new Set(prev).add(ideaId));
    }
    
    try {
      const voteData = {
        ideaId,
        walletAddress: account.address,
        voteType: 'upvote'
      };
      
      const res = await fetch(`${API_BASE_URL}/api/market-idea-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData),
      });
      
      if (res.ok) {
        // Refresh data to get accurate vote counts
        await fetchMarketIdeas();
        await fetchUserVotes();
      } else {
        // Revert optimistic update on error
        setMarketIdeas(marketIdeas);
        if (hasVoted) {
          setUserVotes(prev => new Set(prev).add(ideaId));
        } else {
          setUserVotes(prev => {
            const newSet = new Set(prev);
            newSet.delete(ideaId);
            return newSet;
          });
        }
        
        console.error('Vote failed:', res.status);
      }
    } catch (error) {
      // Revert optimistic update on error
      setMarketIdeas(marketIdeas);
      if (hasVoted) {
        setUserVotes(prev => new Set(prev).add(ideaId));
      } else {
        setUserVotes(prev => {
          const newSet = new Set(prev);
          newSet.delete(ideaId);
          return newSet;
        });
      }
      console.error('Vote error:', error);
    } finally {
      setVotingIdeaId(null);
    }
  };

  // Handle form submission
  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account?.address) {
      setSubmitFeedback("Please connect your wallet.");
      setTimeout(() => setSubmitFeedback(null), 3000);
      return;
    }
    
    if (!title.trim()) {
      setSubmitFeedback("Please enter a market title.");
      setTimeout(() => setSubmitFeedback(null), 3000);
      return;
    }
    
    setIsSubmitting(true);
    setSubmitFeedback("Submitting market idea...");
    
    try {
      const ideaData = {
        title: title.trim(),
        description: '', // Empty string since we removed this field
        rules: '', // Empty string since we removed this field
        walletAddress: account.address
      };
      
      console.log('Submitting idea data:', ideaData);
      console.log('API URL:', `${API_BASE_URL}/api/market-ideas`);
      
      const res = await fetch(`${API_BASE_URL}/api/market-ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ideaData),
      });
      
      if (res.ok) {
        setSubmitFeedback("Market idea submitted successfully!");
        setTitle('');
        await fetchMarketIdeas(); // Refresh the list
        setTimeout(() => setSubmitFeedback(null), 3000);
      } else {
        console.error('Response status:', res.status);
        console.error('Response headers:', res.headers);
        const errorData = await res.json();
        console.error('API error response:', errorData);
        setSubmitFeedback(errorData.error || "Failed to submit market idea.");
        setTimeout(() => setSubmitFeedback(null), 3000);
      }
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitFeedback("Failed to submit market idea. Please try again.");
      setTimeout(() => setSubmitFeedback(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sort ideas by votes (highest first)
  const sortedIdeas = [...marketIdeas].sort((a, b) => b.netVotes - a.netVotes);

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center pt-8 w-full">
        <div className="w-full max-w-4xl mx-auto px-4">
          <h2 className="text-lg font-semibold text-[#171A22] mb-2">Rules</h2>
          <div className="text-base text-gray-700 mb-6">
            Vote for your favorite markets. Each week, the most popular market will be created and propose new questions on the Submit New Idea tab. 
          </div>
          {/* Tabs */}
          <div className="flex mb-8 border-b border-gray-200">
            <button
              className={`px-6 py-2 font-semibold text-sm focus:outline-none transition border-b-2 ${activeTab === 'proposed' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}
              onClick={() => setActiveTab('proposed')}
              type="button"
            >
              Proposed Markets
            </button>
            <button
              className={`ml-2 px-6 py-2 font-semibold text-sm focus:outline-none transition border-b-2 ${activeTab === 'submit' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}
              onClick={() => setActiveTab('submit')}
              type="button"
            >
              Submit New Idea
            </button>
          </div>

          {/* Tab Panels */}
          {activeTab === 'submit' && (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-8 mb-8">
              <h2 className="text-xl font-bold text-[#171A22] mb-4">Submit New Market Idea</h2>
              <form onSubmit={handleSubmitIdea} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Market Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Was Atlantis a real place?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>


                <button
                  type="submit"
                  disabled={isSubmitting || !account?.address}
                  className="w-full font-semibold px-6 py-3 rounded-lg shadow transition disabled:opacity-50 bg-black text-white hover:bg-gray-800"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Market Idea'}
                </button>
                {submitFeedback && (
                  <div className={`text-center font-semibold ${
                    submitFeedback.includes('success') ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {submitFeedback}
                  </div>
                )}
              </form>
            </div>
          )}

          {activeTab === 'proposed' && (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-[#171A22] mb-6">Proposed Markets</h2>
              {loading ? (
                <div className="text-gray-500 text-center py-8">Loading market ideas...</div>
              ) : sortedIdeas.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No market ideas submitted yet.</div>
              ) : (
                <div className="space-y-6">
                  {sortedIdeas.map((idea, idx) => (
                    <div
                      key={idea.id}
                      className="border rounded-lg py-3 px-6 bg-white shadow-sm border-gray-200"
                    >
                      <div className="flex">
                        {/* Voting column */}
                        <div className="flex flex-col items-center mr-4 select-none">
                          <button
                            className={`text-lg p-0 mb-1 transition-all duration-200 ${
                              votingIdeaId === idea.id ? 'opacity-50 cursor-not-allowed' : ''
                            } ${userVotes.has(idea.id) ? 'bg-green-600 rounded-lg p-1' : ''}`}
                            onClick={() => handleVote(idea.id)}
                            aria-label={userVotes.has(idea.id) ? "Remove vote" : "Upvote"}
                            type="button"
                            disabled={votingIdeaId === idea.id}
                          >
                            <svg 
                              width="20" 
                              height="20" 
                              viewBox="0 0 20 20" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2"
                              className={userVotes.has(idea.id) ? 'text-white' : 'text-gray-600'}
                            >
                              <path d="M10 2v16" strokeLinecap="round"/>
                              <path d="M5 7l5-5 5 5" strokeLinecap="round"/>
                            </svg>
                          </button>
                          <div className="flex flex-col items-center">
                            <div className="bg-black text-white rounded-full px-1.5 py-0.5 text-xs font-semibold mb-1" style={{minWidth: '1.48rem', textAlign: 'center'}}>
                              {idea.netVotes}
                            </div>
                            <div className="text-green-600 text-xs font-semibold min-h-[1.25rem]" style={{minHeight: '1.25rem'}}>
                              {userVotes.has(idea.id) ? '+1' : <span className="opacity-0">+0</span>}
                            </div>
                          </div>
                        </div>
                        {/* Idea content */}
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="text-sm font-semibold mr-2">#{idx + 1}</span>
                            <span className="text-sm font-bold text-[#171A22]">
                              {idea.title}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Submitted by {idea.walletAddress.slice(0, 6)}...{idea.walletAddress.slice(-4)} • {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : 'Unknown date'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="w-full h-8 bg-[#f8f9fa]"></div>
    </div>
  );
} 