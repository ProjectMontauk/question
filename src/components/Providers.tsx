"use client";

import { ThirdwebProvider } from "thirdweb/react";

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
} 