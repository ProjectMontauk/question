import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { tokenContract } from "../../constants/contracts";
import { parseAmountToWei } from "../utils/parseAmountToWei";
import { useState, useEffect, useRef } from "react";

export default function AccountSetupLoader() {
  const account = useActiveAccount();
  const { refetch } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });
  const { mutate: sendTransaction } = useSendTransaction();
  const [showLoader, setShowLoader] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [hasCheckedAutoDeposit, setHasCheckedAutoDeposit] = useState(false);
  const successTimer = useRef<NodeJS.Timeout | null>(null);

  // Check auto-deposit status when account connects
  useEffect(() => {
    if (account?.address && !hasCheckedAutoDeposit) {
      console.log('🔍 AccountSetupLoader: Checking auto-deposit status...');
      setHasCheckedAutoDeposit(true);
      
      fetch(`/api/auto-deposit?walletAddress=${account.address}`)
        .then(response => response.json())
        .then(data => {
          console.log('📊 AccountSetupLoader: Auto-deposit status:', data.hasReceivedAutoDeposit);
          
          // If user hasn't received auto-deposit, show loader and start minting
          if (!data.hasReceivedAutoDeposit) {
            console.log('🚀 AccountSetupLoader: New user - showing loader and starting minting');
            setShowLoader(true);
            setIsMinting(true);
          } else {
            console.log('🚫 AccountSetupLoader: Existing user - no loader needed');
          }
        })
        .catch(error => {
          console.error('❌ AccountSetupLoader: Error checking auto-deposit status:', error);
         
        });
    }
  }, [account?.address, hasCheckedAutoDeposit]);

  // Mint tokens when isMinting is true
  useEffect(() => {
    if (isMinting && account) {
      console.log('💰 AccountSetupLoader: Starting minting process...');
      
      const parsedAmount = parseAmountToWei("100");
      console.log('💰 AccountSetupLoader: Parsed amount:', parsedAmount);
      
      const transaction = prepareContractCall({
        contract: tokenContract,
        method: "function mint(address account, uint256 amount)",
        params: [account.address, parsedAmount],
      });
      
      console.log('📝 AccountSetupLoader: Transaction prepared, sending...');
      
      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log('✅ AccountSetupLoader: Minting successful!', result);
          setIsMinting(false);
          refetch(); // Refresh balance
          
          // Record the auto-deposit in the database
          fetch('/api/auto-deposit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              walletAddress: account.address,
              amount: '100',
              transactionHash: result.transactionHash || 'unknown'
            }),
          })
          .then(response => response.json())
          .then(data => {
            console.log('📝 AccountSetupLoader: Auto-deposit recorded:', data);
          })
          .catch(error => {
            console.error('❌ AccountSetupLoader: Error recording auto-deposit:', error);
          });
        },
        onError: (error) => {
          console.error('❌ AccountSetupLoader: Minting failed:', error);
          setIsMinting(false);
        }
      });
    }
  }, [isMinting, account, sendTransaction, refetch]);



  // Show terms step after minting completes
  useEffect(() => {
    if (showLoader && !isMinting && !showTerms && !showSuccess) {
      console.log('✅ AccountSetupLoader: Showing terms...');
      setShowTerms(true);
    }
  }, [showLoader, isMinting, showTerms, showSuccess]);

  // Show success message after user agrees to terms
  useEffect(() => {
    if (showTerms && !showSuccess) {
      // This will be triggered by user clicking "I Agree"
    }
  }, [showTerms, showSuccess]);

  // Start a single timer when showSuccess becomes true
  useEffect(() => {
    if (showSuccess) {
      successTimer.current = setTimeout(() => {
        setShowLoader(false);
        setShowSuccess(false);
      }, 3000);
      return () => {
        if (successTimer.current) clearTimeout(successTimer.current);
      };
    }
  }, [showSuccess]);

  // Reset states when account changes
  useEffect(() => {
    if (account?.address) {
      setShowLoader(false);
      setShowTerms(false);
      setShowSuccess(false);
      setIsMinting(false);
      setHasCheckedAutoDeposit(false);
    }
  }, [account?.address]);

  const handleAgreeToTerms = () => {
    setShowTerms(false);
    setShowSuccess(true);
  };

  const handleDismiss = () => {
    setShowLoader(false);
    setShowSuccess(false);
    setShowTerms(false);
    if (successTimer.current) clearTimeout(successTimer.current);
  };

  if (!showLoader) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-1/2 z-50" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="bg-white rounded-lg p-8 w-[90vw] max-w-[90vw] md:max-w-md md:w-full mx-2 shadow-xl border border-gray-200 relative">
        <div className="text-center">
          {!showTerms && !showSuccess ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Creating Your Account</h2>
              <p className="text-gray-600 mb-4">
                  Setting up your account and minting 𐆖100 of test funds so you can start trading!
              </p>
            </>
          ) : showTerms ? (
            <>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Important Terms & Conditions</h2>
              <div className="mb-6 text-left">
                <p className="text-sm text-gray-700 mb-3">
                  <strong>Please read carefully before proceeding:</strong>
                </p>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• 𐆖 (Nash) is an <strong>in-game currency</strong> used exclusively within The Citizen platform</li>
                  <li>• These tokens are <strong>NOT redeemable</strong> for real money or any real-world value</li>
                  <li>• Test funds are provided for demonstration and trading practice purposes only</li>
                  <li>• By proceeding, you acknowledge that you understand these are virtual tokens with no monetary value</li>
                </ul>
              </div>
              <button
                onClick={handleAgreeToTerms}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                I Agree
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
                aria-label="Close"
              >
                ×
              </button>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to The Citizen!</h2>
              <p className="text-gray-600">
                Your account has been created and 𐆖100 of test funds has been deposited. You&apos;ve agreed to our terms and are ready to start trading!
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 