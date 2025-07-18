"use client";

import { ThirdwebProvider } from "thirdweb/react";
import AutoDeposit from "./AutoDeposit";
import AccountSetupLoader from "./AccountSetupLoader";

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThirdwebProvider>
      <AutoDeposit />
      <AccountSetupLoader />
      {children}
    </ThirdwebProvider>
  );
} 