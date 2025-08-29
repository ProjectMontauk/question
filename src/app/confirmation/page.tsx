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
  const [message, setMessage] = useState('');
  const [mintDetails, setMintDetails] = useState<{
    nashAmount: string;
    customerWallet: string;
    purchaseAmount: string;
  } | null>(null);
  
  // Use useRef to track minting status (persists across re-renders)
  const hasMintedRef = useRef(false);
  const mintingStartedRef = useRef(false);

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
    const success = searchParams.get('success');
    const nashAmount = searchParams.get('nashAmount');
    const customerWallet = searchParams.get('customerWallet');
    const purchaseAmount = searchParams.get('purchaseAmount');

    if (success !== 'true' || !nashAmount || !customerWallet || !purchaseAmount) {
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
      purchaseAmount
    });

    setMessage(`Payment successful! You purchased ${nashAmount} Nash tokens for $${purchaseAmount}.`);
  }, [searchParams, account?.address]);

  // Auto-execute minting when wallet connects and details are available
  // BUT only if we haven't already started minting (prevent double minting)
  useEffect(() => {
    if (mintDetails && account?.address && !isMinting && !mintingStartedRef.current && !hasMintedRef.current) {
      console.log('🚀 Starting auto-minting...');
      mintingStartedRef.current = true;
      executeMinting();
    }
  }, [mintDetails, account?.address, isMinting]);

  // Function to execute minting
  const executeMinting = async () => {
    if (!mintDetails || !account?.address || isMinting) return;
    
    console.log('🔍 executeMinting called with refs:', {
      hasMintedRef: hasMintedRef.current,
      mintingStartedRef: mintingStartedRef.current,
      isMinting,
      accountAddress: account.address
    });
    
    setIsMinting(true);
    setMessage(`Minting ${mintDetails.nashAmount} Nash tokens...`);
    
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
          onSuccess: (result) => {
            console.log('✅ Mint transaction successful:', result);
            setMessage(`🎉 Successfully minted ${mintDetails.nashAmount} Nash tokens! Transaction: ${result.transactionHash}`);
            
            // Set the refs to prevent double minting
            hasMintedRef.current = true;
            mintingStartedRef.current = true;
            
            // Refresh the user's balance
            refetchBalance();
          },
          onError: (error) => {
            console.error('❌ Mint transaction failed:', error);
            setMessage(`Failed to mint tokens: ${error.message}`);
            
            // Reset the minting started flag on error so user can retry
            mintingStartedRef.current = false;
          }
        });
      
    } catch (error) {
      console.error('Error preparing mint transaction:', error);
      setMessage('Failed to prepare mint transaction');
    } finally {
      setIsMinting(false);
    }
  };

  // Function to go back to deposit page
  const goToDeposit = () => {
    router.push('/deposit');
  };

  if (!mintDetails) {
    return (
      <div>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment</h1>
            <p className="text-gray-600">Please wait while we confirm your payment...</p>
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
                    <span className="text-[18px] font-normal">𐆖</span>{mintDetails.nashAmount}
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
                    {hasMintedRef.current ? 'Tokens already minted!' : isMinting ? 'Minting in progress...' : 'Ready to mint'}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    {hasMintedRef.current 
                      ? 'Your Nash tokens have been successfully minted to your wallet'
                      : isMinting 
                        ? 'Please approve the transaction in your wallet' 
                        : 'Ready to mint your tokens'
                    }
                  </p>
                </div>
              </div>
            </div>



            {/* Action Buttons */}
            <div className="flex justify-center">
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
