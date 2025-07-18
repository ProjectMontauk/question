import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { tokenContract } from "../../constants/contracts";
import { parseAmountToWei } from "../utils/parseAmountToWei";
import { useEffect, useRef } from "react";

export default function AutoDeposit() {
  const account = useActiveAccount();
  const { data: balance, refetch } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });
  const { mutate: sendTransaction } = useSendTransaction();
  const hasAttemptedMint = useRef(false);

  useEffect(() => {
    // Reset the flag when account changes
    if (account?.address) {
      hasAttemptedMint.current = false;
    }
  }, [account?.address]);

  useEffect(() => {
    // Only attempt minting once per account and when balance is confirmed to be 0
    if (account && balance !== undefined && Number(balance) === 0 && !hasAttemptedMint.current) {
      hasAttemptedMint.current = true;
      
      const parsedAmount = parseAmountToWei("100");
      const transaction = prepareContractCall({
        contract: tokenContract,
        method: "function mint(address account, uint256 amount)",
        params: [account.address, parsedAmount],
      });
      
      sendTransaction(transaction, {
        onSuccess: () => {
          refetch();
        },
        onError: (error) => {
          hasAttemptedMint.current = false;
        }
      });
    }
  }, [account, balance, sendTransaction, refetch]);

  return null;
} 