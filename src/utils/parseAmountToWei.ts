// utils/parseAmountToWei.ts
export function parseAmountToWei(amount: string | number): bigint {
    // Convert to string and trim whitespace
    const amtStr = String(amount).trim();
    if (!amtStr || isNaN(Number(amtStr))) return 0n;
  
    // Split on decimal point
    const [whole, fraction = ""] = amtStr.split(".");
    // Pad or trim the fraction to 18 digits
    const fractionPadded = (fraction + "0".repeat(18)).slice(0, 18);
    // Combine whole and fraction, then convert to BigInt
    return BigInt(whole + fractionPadded);
  }