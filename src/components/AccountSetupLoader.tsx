import { useActiveAccount, useReadContract } from "thirdweb/react";
import { tokenContract } from "../../constants/contracts";
import { useState, useEffect, useRef } from "react";

export default function AccountSetupLoader() {
  const account = useActiveAccount();
  const { data: balance } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });
  const [showLoader, setShowLoader] = useState(false);
  const [hasShownLoader, setHasShownLoader] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Show loader when user first connects and has 0 balance
    if (account?.address && balance !== undefined && Number(balance) === 0 && !hasShownLoader) {
      setShowLoader(true);
      setHasShownLoader(true);
      setShowSuccess(false);
    }
  }, [account?.address, balance, hasShownLoader]);

  // Show success message when funds arrive
  useEffect(() => {
    if (account?.address && balance !== undefined && Number(balance) > 0 && showLoader && !showSuccess) {
      setShowSuccess(true);
    }
  }, [account?.address, balance, showLoader, showSuccess]);

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

  // Reset hasShownLoader when account changes
  useEffect(() => {
    if (account?.address) {
      setHasShownLoader(false);
    }
  }, [account?.address]);

  const handleDismiss = () => {
    setShowLoader(false);
    setShowSuccess(false);
    if (successTimer.current) clearTimeout(successTimer.current);
  };

  if (!showLoader) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-1/2 z-50" style={{ transform: 'translate(-50%, -50%)' }}>
      <div className="bg-white rounded-lg p-8 w-[90vw] max-w-[90vw] md:max-w-md md:w-full mx-2 shadow-xl border border-gray-200 relative">
        <div className="text-center">
          {!showSuccess ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Creating Your Account</h2>
              <p className="text-gray-600 mb-4">
                Setting up your The Citizen account and auto-depositing $100 of test funds so you can start trading.
              </p>
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Ready!</h2>
              <p className="text-gray-600">
                Your account has been created and $100 of test funds has been deposited. You&apos;re ready to start trading!
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 