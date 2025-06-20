"use client";

import React, { useEffect } from "react";
import { ConnectButton, useActiveAccount, useReadContract } from "thirdweb/react";
import { client } from "../src/client";
import { useRouter } from "next/navigation";
import { tokenContract } from "../constants/contracts";

// TODO: Replace this with the actual ThirdWeb inAppWallet import
// import { InAppWalletButton } from "thirdweb-package-path";

function formatBalance(balance: bigint | undefined): string {
  if (!balance) return "--";
  // Divide by 10^18 and show whole numbers only
  return (Number(balance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const Navbar = () => {
  const router = useRouter();
  const account = useActiveAccount();
  const { data: balance, isPending, refetch } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });

  // Polling mechanism for cash balance updates
  useEffect(() => {
    if (!account?.address) return;

    // Initial fetch
    refetch();

    // Set up polling interval (check every 3 seconds)
    const interval = setInterval(() => {
      refetch();
    }, 3000);

    // Cleanup interval on unmount or account change
    return () => clearInterval(interval);
  }, [account?.address, refetch]);

  return (
    <nav className="w-full flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white">
      <div className="ml-18">
        <h1 className="text-2xl font-bold text-[#171A22]">Tinfoil</h1>
        <p className="text-sm text-gray-500">Time Discovers Truth</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          className="bg-transparent border border-[#171A22] text-[#171A22] px-4 py-2 rounded-lg font-medium text-base hover:bg-[#f8f9fa] transition"
          onClick={() => router.push("/")}
        >
          Home
        </button>
        <div className="text-center">
          <div className="text-[#171A22] font-medium text-base">Cash</div>
          <div className="text-green-600 font-semibold text-sm">
            ${isPending ? "..." : formatBalance(balance)}
          </div>
        </div>
        <ConnectButton client={client} />
        {/* Example: <InAppWalletButton /> */}
      </div>
    </nav>
  );
};

export default Navbar;
