'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import Navbar from '../../../components/Navbar';
import { tokenContract } from '../../../constants/contracts';

export default function DepositPage() {
  const account = useActiveAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stripe, setStripe] = useState<Stripe | null>(null);

  // Get user's current balance
  const { data: balance } = useReadContract({
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

  // Initialize Stripe
  useEffect(() => {
    const initStripe = async () => {
      const stripeInstance = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      setStripe(stripeInstance);
    };
    initStripe();
  }, []);



  const handlePayment = async (dollarAmount: number, nashAmount: number) => {
    if (!stripe || !account?.address) {
      setMessage('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Create checkout session
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: dollarAmount,
          nashAmount: nashAmount,
          customerWallet: account.address, // Add the user's wallet address
        }),
      });

      const { url, error } = await response.json();
      
      if (error) {
        throw new Error(error);
      }

      // Redirect directly to Stripe Checkout URL
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (error) {
      console.error('Payment error:', error);
      setMessage('Payment failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Deposit Funds</h1>
            <p className="text-gray-600 mb-8">Add funds to your account to start trading</p>

            {/* Current Balance Display */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Current Balance</h2>
              <div className="text-2xl font-bold text-green-600">
                <span className="text-[23.5px] font-normal">𐆖</span> {account?.address ? formatBalance(balance) : '--'}
              </div>
            </div>



            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-lg mb-6 ${
                message.includes('failed') || message.includes('error') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {message}
              </div>
            )}

            {/* Buy Nash Offers */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Buy Nash (𐆖)</h3>
              <div className="space-y-4">
                {/* First Row - Fixed Offers */}
                <div className="grid grid-cols-2 gap-4">
                  {/* First Offer */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-[23.5px] font-normal text-white">𐆖</span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-900 mb-3">
                      <span className="text-[18px] font-normal">𐆖</span>250
                    </div>
                    <button
                      onClick={() => handlePayment(10, 250)}
                      disabled={isLoading || !account?.address}
                      className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Processing...' : 'Buy $10'}
                    </button>
                  </div>

                  {/* Second Offer */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-[18px] font-normal text-white">𐆖</span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-900 mb-3">
                      <span className="text-[18px] font-normal">𐆖</span>500
                    </div>
                    <button
                      onClick={() => handlePayment(20, 500)}
                      disabled={isLoading || !account?.address}
                      className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Processing...' : 'Buy $20'}
                    </button>
                  </div>
                </div>

                {/* Second Row - Third Fixed Offer and Custom Amount */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Third Offer - 750 Denarius for $30 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-[18px] font-normal text-white">𐆖</span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-900 mb-3">
                      <span className="text-[18px] font-normal">𐆖</span>750
                    </div>
                    <button
                      onClick={() => handlePayment(30, 750)}
                      disabled={isLoading || !account?.address}
                      className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Processing...' : 'Buy $30'}
                    </button>
                  </div>

                  {/* Fourth Offer - 1000 Denarius for $40 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-[18px] font-normal text-white">𐆖</span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-900 mb-3">
                      <span className="text-[18px] font-normal">𐆖</span>1000
                    </div>
                    <button
                      onClick={() => handlePayment(40, 1000)}
                      disabled={isLoading || !account?.address}
                      className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Processing...' : 'Buy $40'}
                    </button>
                  </div>
                </div>
              </div>
            </div>




            {/* Additional Information */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">How it works</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Buy Nash (𐆖) with Credit/Debit, Paypal, or Apple Pay </p>
                <p>• Funds will be deposited to your account and added to your balance</p>
                <p>• You can use these funds to trade on any market</p>
                <p>• Deposits are typically processed within a few seconds</p>
                <p>• Nash are not redeemable for cash at this time, but we are working on this...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}