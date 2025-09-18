'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import EvidenceComments from '../../../../components/EvidenceComments';
import Navbar from '../../../../../components/Navbar';

interface Evidence {
  id: number;
  type: 'yes' | 'no';
  title: string;
  url?: string;
  description: string;
  netVotes: number;
  walletAddress: string;
  createdAt?: string;
  commentCount: number;
}

export default function EvidenceDiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const account = useActiveAccount();
  
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);

  useEffect(() => {
    const fetchEvidence = async () => {
      try {
        const evidenceId = resolvedParams.id;
        if (!evidenceId) return;
        
        // Fetch evidence from the new API route
        const response = await fetch(`/api/evidence/discussion/${evidenceId}`);
        if (!response.ok) {
          throw new Error('Evidence not found');
        }
        
        const evidenceData = await response.json();
        setEvidence(evidenceData);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load evidence:', err);
        setError('Failed to load evidence');
        setIsLoading(false);
      }
    };

    if (resolvedParams.id) {
      fetchEvidence();
    }
  }, [resolvedParams.id]);

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const isPdfUrl = (url: string): boolean => {
    return url.toLowerCase().includes('/uploads/evidence/') || 
           url.toLowerCase().includes('blob.vercel-storage.com') ||
           url.toLowerCase().endsWith('.pdf');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error || !evidence) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Evidence Not Found</h1>
          <p className="text-gray-600 mb-6">The evidence you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gray-50">

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Evidence Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            {/* Evidence Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => router.back()}
                    aria-label="Back to Market"
                    className="inline-flex items-center text-gray-600 hover:text-gray-900"
                    type="button"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    evidence.type === 'yes' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {evidence.type === 'yes' ? 'YES' : 'NO'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {evidence.createdAt && formatDate(evidence.createdAt)}
                  </span>
                </div>
                
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
                  {evidence.title}
                </h1>
                
                {evidence.description && (
                  <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
                    {evidence.description}
                  </p>
                )}
                
                {evidence.url && (
                  <a
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View Source ({isPdfUrl(evidence.url) ? 'pdf' : getDomain(evidence.url)})
                  </a>
                )}
              </div>
              
              {/* Voting Section - Hidden on mobile */}
              <div className="hidden md:flex flex-col items-center mt-4 md:mt-0 md:ml-6">
                <div className="text-gray-900 text-lg font-bold mb-2">
                  {evidence.netVotes}
                </div>
                <div className="text-sm text-gray-600 text-center">
                  Net Votes
                </div>
              </div>
            </div>
            
            {/* Evidence Footer */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Submitted by {evidence.walletAddress.slice(0, 6)}...{evidence.walletAddress.slice(-4)}</span>
                <span>{evidence.commentCount} comments</span>
              </div>
            </div>
          </div>

          {/* Discussion Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Discussion</h2>
            
            {/* Comments Component */}
            <EvidenceComments
              evidence={evidence}
              currentUserAddress={account?.address}
              onShowSignInModal={() => setShowSignInModal(true)}
            />
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
                Please sign in to add a comment
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