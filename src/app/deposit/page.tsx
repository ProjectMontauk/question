'use client';

import { useState } from 'react';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { prepareContractCall, readContract } from 'thirdweb';
import { useSendTransaction } from 'thirdweb/react';
import Navbar from '../../../components/Navbar';
import { tokenContract } from '../../../constants/contracts';

export default function DepositPage() {
  const account = useActiveAccount();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Get user's current balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address || ""],
  });

  const { mutate: sendTransaction } = useSendTransaction();

  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return "0";
    const amount = Number(balance) / 1e18;
    return amount % 1 === 0 
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !account?.address) return;

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setMessage('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Convert USD amount to USDC (6 decimals)
      const amountInUSDC = BigInt(Math.floor(depositAmount * 1e6));
      
      // For now, we'll simulate a deposit since we need to implement the actual deposit logic
      // This would typically involve a payment processor or bridge
      setMessage(`Deposit request submitted for $${depositAmount}`);
      
      // TODO: Implement actual deposit logic
      // This could involve:
      // 1. Payment processor integration (Stripe, etc.)
      // 2. Bridge from another chain
      // 3. Direct USDC transfer
      
    } catch (error) {
      console.error('Deposit error:', error);
      setMessage('Deposit failed. Please try again.');
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
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Current Balance</h2>
              <div className="text-2xl font-bold text-green-600">
                ${account?.address ? formatBalance(balance) : '--'}
              </div>
            </div>

            {/* Deposit Form */}
            <form onSubmit={handleDeposit} className="space-y-6">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-lg"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Message Display */}
              {message && (
                <div className={`p-4 rounded-lg ${
                  message.includes('failed') || message.includes('error') 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {message}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!amount || isLoading || !account?.address}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Processing...' : 'Deposit Funds'}
              </button>

              {/* Wallet Connection Notice */}
              {!account?.address && (
                <div className="text-center text-gray-500">
                  Please connect your wallet to deposit funds
                </div>
              )}
            </form>

            {/* Additional Information */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">How it works</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Enter the amount you want to deposit in USD</p>
                <p>• Funds will be converted to USDC and added to your balance</p>
                <p>• You can use these funds to trade on any market</p>
                <p>• Deposits are typically processed within minutes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}