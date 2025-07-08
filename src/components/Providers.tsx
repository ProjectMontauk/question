"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import AutoDeposit from "./AutoDeposit";

const wallets = [
  inAppWallet({
    smartAccount: {
      chain: polygonAmoy,
      sponsorGas: true,
    },
  }),
];

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThirdwebProvider>
      <AutoDeposit />
      {children}
    </ThirdwebProvider>
  );
} 