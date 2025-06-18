"use client";

import React from "react";
import { ConnectButton } from "thirdweb/react";
import { client } from "../src/client";
import { useRouter } from "next/navigation";

// TODO: Replace this with the actual ThirdWeb inAppWallet import
// import { InAppWalletButton } from "thirdweb-package-path";

const Navbar = () => {
  const router = useRouter();
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
        <ConnectButton client={client} />
        {/* Example: <InAppWalletButton /> */}
      </div>
    </nav>
  );
};

export default Navbar;
