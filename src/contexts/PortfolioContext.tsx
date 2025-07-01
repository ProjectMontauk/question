"use client";

import React, { createContext, useContext, useState } from "react";

interface PortfolioContextType {
  portfolioValue: string;
  setPortfolioValue: (value: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [portfolioValue, setPortfolioValue] = useState<string>("--");
  return (
    <PortfolioContext.Provider value={{ portfolioValue, setPortfolioValue }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) throw new Error("usePortfolio must be used within a PortfolioProvider");
  return context;
} 