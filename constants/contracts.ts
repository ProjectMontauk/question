import { client } from "../src/client";
import { getContract } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";

export const marketContractAddress = "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a";
export const tokenContractAddress = "0x6e915a7a2940f3f3f95e65205b9ebf89df0aa141";

export const tokenContract = getContract({
    client: client,
    chain: polygonAmoy,
    address: tokenContractAddress,
})

export const marketContract = getContract({
    client,
    chain: polygonAmoy,
    address: marketContractAddress,
  });