'use client';

import { useState, useEffect, useRef } from 'react';
import { useActiveAccount, useReadContract, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall } from 'thirdweb';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { tokenContract } from '../../../constants/contracts';

export default function ConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();
  
  const [isMinting, setIsMinting] = useState(false);
  const [message, setMessage] = useState('Mint in progress...');
  const [subtitleMessage, setSubtitleMessage] = useState('');
  const [mintDetails, setMintDetails] = useState<{
    nashAmount: string;
    customerWallet: string;
    purchaseAmount: string;
    sessionId: string;
  } | null>(null);
  
  // Use ref to prevent multiple minting attempts
  const hasStartedMinting = useRef(false);
  


  // Hook for sending transactions
  const { mutate: sendTransaction } = useSendTransaction();

  // Get user's current balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address || ""],
  });

  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return "0";
    const amount = Number(balance) / 1e18;
    return amount % 1 === 0 
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Extract URL parameters and validate payment
  useEffect(() => {
    if (!searchParams) return;
    
    const success = searchParams.get('success');
    const nashAmount = searchParams.get('nashAmount');
    const customerWallet = searchParams.get('customerWallet');
    const purchaseAmount = searchParams.get('purchaseAmount');
    const sessionId = searchParams.get('session_id');

    if (success !== 'true' || !nashAmount || !customerWallet || !purchaseAmount || !sessionId) {
      setMessage('Invalid confirmation link. Please try again.');
      return;
    }

    // Verify the wallet address matches the connected wallet
    if (account?.address && account.address.toLowerCase() !== customerWallet.toLowerCase()) {
      setMessage('Wallet mismatch. Please connect the wallet used for payment.');
      return;
    }

    setMintDetails({
      nashAmount,
      customerWallet,
      purchaseAmount,
      sessionId
    });

    // Set initial subtitle message
    setSubtitleMessage(`Minting 𐆖${nashAmount} to be added to your account...`);
  }, [searchParams, account?.address]);

  // Auto-execute minting when wallet connects and details are available
  useEffect(() => {
    // Only execute if isMinting is false
    if (isMinting) {
      console.log('🚫 useEffect blocked - already minting');
      return;
    }
    
    let isActive = true;
    
    console.log('🔍 useEffect triggered with:', {
      mintDetails: !!mintDetails,
      accountAddress: !!account?.address,
      isMinting: isMinting,
      timestamp: new Date().toISOString()
    });
    
    if (mintDetails && account?.address && !hasStartedMinting.current) {
      console.log('🚀 Checking session status before minting...');
      
      // Set flags to prevent multiple calls
      hasStartedMinting.current = true;
      setIsMinting(true);
      
      // Only proceed if component is still mounted
      if (isActive) {
        checkSessionStatus();
      }
    }
    
    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isActive = false;
    };
  }, [mintDetails, account?.address]); // Removed isMinting from dependencies to prevent loops

  // Function to check if this session has already been processed
  const checkSessionStatus = async () => {
    // Double-check protection
    if (hasStartedMinting.current === false) {
      console.log('🚫 checkSessionStatus blocked - minting not started');
      return;
    }
    
    if (!mintDetails?.sessionId) {
      console.log('⚠️ No session ID, cannot proceed with minting');
      setMessage('Invalid session. Cannot proceed with minting.');
      setIsMinting(false);
      hasStartedMinting.current = false;
      return;
    }
    
    console.log('🔍 Checking session status for:', mintDetails.sessionId);
    
    try {
      const response = await fetch('/api/check-session-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: mintDetails.sessionId })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Session status response:', data);
        
        if (data.alreadyProcessed) {
          console.log('✅ Session already processed. Skipping mint.');
          setMessage('Tokens already minted!');
          setSubtitleMessage(`Already deposited 𐆖${mintDetails.nashAmount} into your account!`);
          setIsMinting(false);
          return;
        }
        
        if (data.ready) {
          console.log('🚀 Session ready for minting. Starting...');
          executeMinting();
        } else {
          console.log('⏳ Session not ready yet. Cannot proceed with minting.');
          setMessage('Payment processing. Please wait...');
          setIsMinting(false);
          hasStartedMinting.current = false;
        }
      } else {
        console.log('⚠️ Session status check failed. Cannot proceed with minting.');
        setMessage('Session check failed. Cannot proceed with minting.');
        setIsMinting(false);
      }
    } catch (error) {
      console.error('❌ Error checking session status:', error);
      setMessage('Session check failed. Cannot proceed with minting.');
      setIsMinting(false);
    }
  };



    // Function to execute minting
  const executeMinting = async () => {
    // Triple-check protection
    if (hasStartedMinting.current === false) {
      console.log('🚫 executeMinting blocked - minting not started');
      return;
    }
    
    // Basic validation checks
    if (!mintDetails || !account?.address) {
      console.log('🚫 executeMinting blocked - missing details or account');
      setIsMinting(false);
      hasStartedMinting.current = false;
      return;
    }
    
    // Only block if we're already minting
    if (isMinting) {
      console.log('🚫 executeMinting blocked - already minting');
      return;
    }
    
    try {
      // Convert nashAmount to wei (18 decimals)
      const mintAmount = BigInt(mintDetails.nashAmount) * BigInt(10 ** 18);
      
      // Prepare the mint transaction
      const transaction = prepareContractCall({
        contract: tokenContract,
        method: "function mint(address account, uint256 amount)",
        params: [account.address, mintAmount],
      });
      
      // Send the transaction
      sendTransaction(transaction, {
        onSuccess: async (result) => {
          console.log('✅ Mint transaction successful:', result);
          setMessage('Mint Successful!');
          setSubtitleMessage(`Deposited 𐆖${mintDetails.nashAmount} into your account!`);
          
          // Mark this session as processed in the database
          try {
            await fetch('/api/mark-session-processed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: mintDetails.sessionId,
                nashAmount: mintDetails.nashAmount,
                customerWallet: mintDetails.customerWallet,
                purchaseAmount: mintDetails.purchaseAmount,
                status: 'completed'
              })
            });
            console.log('✅ Session marked as processed in database');
          } catch (error) {
            console.error('❌ Failed to mark session as processed:', error);
          }
          
          // Refresh the user's balance
          refetchBalance();
        },
        onError: (error) => {
          console.error('❌ Mint transaction failed:', error);
          setMessage('Minting failed. Please try again.');
          setSubtitleMessage(`Minting 𐆖${mintDetails.nashAmount} to be added to your account...`);
          // Reset flags on error
          setIsMinting(false);
          hasStartedMinting.current = false;
        }
      });
      
    } catch (error) {
      console.error('Error preparing mint transaction:', error);
      setMessage('Failed to prepare mint transaction. Please try again.');
      setSubtitleMessage(`Minting 𐆖${mintDetails.nashAmount} to be added to your account...`);
      // Reset flags on error
      setIsMinting(false);
      hasStartedMinting.current = false;
    } finally {
      setIsMinting(false);
      hasStartedMinting.current = false;
    }
  };

  // Function to go back to deposit page
  const goToDeposit = () => {
    router.push('/deposit');
  };



  // Show loading state if mintDetails is not yet loaded
  if (!mintDetails) {
    return (
      <div>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading...</h1>
            <p className="text-gray-600">Preparing your confirmation page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            {/* Success Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-green-600 mb-2">Payment Successful!</h1>
              <p className="text-gray-600">Your Nash tokens are being minted to your wallet</p>
            </div>



            {/* Payment Details */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-green-900 mb-4">Payment Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nash Tokens:</span>
                  <span className="font-semibold text-green-900">
                    <span className="text-[16.5px] font-normal">𐆖</span>{mintDetails.nashAmount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-semibold text-green-900">${mintDetails.purchaseAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Wallet Address:</span>
                  <span className="font-mono text-sm text-green-900">
                    {mintDetails.customerWallet.slice(0, 6)}...{mintDetails.customerWallet.slice(-4)}
                  </span>
                </div>
              </div>
            </div>

                        {/* Minting Status */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Minting Status</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-center">
                  <p className="font-medium text-blue-900">
                    {isMinting ? 'Mint in progress...' : message}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    {subtitleMessage}
                  </p>
                </div>
              </div>
            </div>



            {/* Action Buttons */}
            <div className="flex justify-start">
              <button
                onClick={goToDeposit}
                className="bg-gray-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                Back to Deposit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
