"use client";

import { ThirdwebProvider } from "thirdweb/react";
import AutoDeposit from "./AutoDeposit";

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