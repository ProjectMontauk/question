import { client } from "../src/client";
import { getContract } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";

export const marketContractAddress = "0x4127d494258eb3f89e7a40d466f09bfa60e83205"; // New JFK LMSR contract
export const tokenContractAddress = "0xb1b53857c6702ebc8c2e924873f2fd4c90c5bc40"; // New JFK token contract
export const conditionalTokensContractAddress = "0x904532f95fe960946b76ecdf95e75a4d89ab2e80"; // New JFK conditional tokens contract

// Moon Landing Market Contracts
export const moonLandingMarketContractAddress = "0x6d6892d6ba83bd9c21707aacbf45269d1211898e";
export const moonLandingConditionalTokensContractAddress = "0x27f2bff72e4669e94810fe52d7e67c9ad27b13f9";

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

export const conditionalTokensContract = getContract({
    client,
    chain: polygonAmoy,
    address: conditionalTokensContractAddress,
  });

// Moon Landing Market Contract Instances
export const moonLandingMarketContract = getContract({
    client,
    chain: polygonAmoy,
    address: moonLandingMarketContractAddress,
  });

export const moonLandingConditionalTokensContract = getContract({
    client,
    chain: polygonAmoy,
    address: moonLandingConditionalTokensContractAddress,
  });

// Helper function to get contracts based on market ID
export function getContractsForMarket(marketId: string) {
  switch (marketId) {
    case 'moon-landing':
      return {
        marketContract: moonLandingMarketContract,
        conditionalTokensContract: moonLandingConditionalTokensContract,
        outcome1PositionId: "81241744392996501442954167419350265018961561271257702254598251888191980798656", // Yes
        outcome2PositionId: "95525080663185639939468249274591047430695283909291654082158662915798152267826", // No
      };
    case 'jfk':
    default:
      return {
        marketContract: marketContract,
        conditionalTokensContract: conditionalTokensContract,
        outcome1PositionId: "30968655683754742826259861795379406501940381095392491054724940515481931906073", // JFK Yes - new position ID
        outcome2PositionId: "77840841398957582649276894914505828498672471545324478817656652121358114794022", // JFK No - new position ID
      };
  }
}