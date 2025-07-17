import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { tokenContract } from "../../constants/contracts";
import { parseAmountToWei } from "../utils/parseAmountToWei";
import { useEffect } from "react";

export default function AutoDeposit() {
  const account = useActiveAccount();
  const { data: balance, refetch } = useReadContract({
    contract: tokenContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [account?.address ?? "0x0000000000000000000000000000000000000000"],
  });
  const { mutate: sendTransaction } = useSendTransaction();

  useEffect(() => {
    if (account && balance !== undefined && Number(balance) === 0) {
      const parsedAmount = parseAmountToWei("100");
      const transaction = prepareContractCall({
        contract: tokenContract,
        method: "function mint(address account, uint256 amount)",
        params: [account.address, parsedAmount],
      });
      sendTransaction(transaction, {
        onSuccess: () => {
          refetch();
        }
      });
    }
  }, [account, balance, sendTransaction, refetch]);

  return null;
} 