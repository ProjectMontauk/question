// src/utils/formatOdds.ts
export function formatOdds(int: bigint | undefined): string {
    if (!int) return "--%";
    // Divide by 2^64 to get decimal, then convert to percentage
    return ((Number(int) / Math.pow(2, 64)) * 100).toFixed(2) + "%";
  }
