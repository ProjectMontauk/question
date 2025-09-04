import { client } from "../src/client";
import { getContract } from "thirdweb";
import { base } from "thirdweb/chains";

export const marketContractAddress = "0xa015eBbaB5c6db0748a504ea71589BE21B2Cbe22"; // JFK Market Contract on Base
export const tokenContractAddress = "0x025bF090c6A0155bCe81D3D75b58Dac6b37EF82f"; // Token Contract on Base
export const conditionalTokensContractAddress = "0xFEE92177cCA79c985b95FB7c1437245340BCaAE2"; // Conditional Tokens Contract on Base

// Moon Landing Market Contracts
export const moonLandingMarketContractAddress = "0xeeaca4019f25e573c33a0de266ba0d1020932cc9"; // Moon Landing Market Contract on Base
export const moonLandingConditionalTokensContractAddress = "0x7dFb064Ae49f5A7101C387717f1CDb1b4f2DF7d3"; // Moon Landing Conditional Tokens Contract on Base

// Bridgitte Macron Market Contracts
export const bridgitteMacronMarketContractAddress = "0x1fef92c81b4ef16b099330d5cb5981b8bfc69383"; // Bridgitte Macron Market Contract on Base
export const bridgitteMacronConditionalTokensContractAddress = "0xac1365907452b72b4015c7718a165e51439635f6"; // Bridgitte Macron Conditional Tokens Contract on Base

export const tokenContract = getContract({
    client: client,
    chain: base,
    address: tokenContractAddress,
})

export const marketContract = getContract({
    client,
    chain: base,
    address: marketContractAddress,
  });

export const conditionalTokensContract = getContract({
    client,
    chain: base,
    address: conditionalTokensContractAddress,
  });

// Moon Landing Market Contract Instances
export const moonLandingMarketContract = getContract({
    client,
    chain: base,
    address: moonLandingMarketContractAddress,
  });

export const moonLandingConditionalTokensContract = getContract({
    client,
    chain: base,
    address: moonLandingConditionalTokensContractAddress,
  });

// Bridgitte Macron Market Contract Instances
export const bridgitteMacronMarketContract = getContract({
    client,
    chain: base,
    address: bridgitteMacronMarketContractAddress,
  });

export const bridgitteMacronConditionalTokensContract = getContract({
    client,
    chain: base,
    address: bridgitteMacronConditionalTokensContractAddress,
  });

// Helper function to get contracts based on market ID
export function getContractsForMarket(marketId: string) {
  switch (marketId) {
    case 'moon-landing':
      return {
        marketContract: moonLandingMarketContract,
        conditionalTokensContract: moonLandingConditionalTokensContract,
        outcome1PositionId: "97045190584393032725705126979012781984659070008452916210401226821468609683793", // Yes - Base position ID
        outcome2PositionId: "78958204779993795274253300281532453836400562991479897783072243516005340819969", // No - Base position ID
      };
    case 'bridgitte-macron':
      return {
        marketContract: bridgitteMacronMarketContract,
        conditionalTokensContract: bridgitteMacronConditionalTokensContract,
        outcome1PositionId: "14946061941943856685761247635395957970889875248982696785634054129822017534367", // Yes - Base position ID
        outcome2PositionId: "75393856958712793303554406582052086676087333995512007275640246125198049807135", // No - Base position ID
      };
    case 'jfk':
    default:
      return {
        marketContract: marketContract,
        conditionalTokensContract: conditionalTokensContract,
        outcome1PositionId: "63109534412325451546451217737273315801307940086008058061930328791531947950174", // JFK Yes - Base position ID
        outcome2PositionId: "66301810619553321140640091715448846820451689612222731173839422851370585795126", // JFK No - Base position ID
      };
  }
}