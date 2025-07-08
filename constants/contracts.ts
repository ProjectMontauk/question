import { client } from "../src/client";
import { getContract } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";

export const marketContractAddress = "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a";
export const tokenContractAddress = "0x6e915a7a2940f3f3f95e65205b9ebf89df0aa141";
export const conditionalTokensContractAddress = "0xc4CcCEEb19999e920F8bc188f516518483362DA7";

// Moon Landing Market Contracts
export const moonLandingMarketContractAddress = "0x6d6892d6ba83bd9c21707aacbf45269d1211898e";
export const moonLandingConditionalTokensContractAddress = "0x27f2bff72e4669e94810fe52d7e67c9ad27b13f9";

// Alien Market Contract
export const alienMarketContractAddress = "0x6186AB73d155CdFdcB18BC9c912469aE4c256129";
export const alienConditionalTokensContractAddress = "0xF1fFfeB7F3135C6a80175f766813Bf2F246f5F59";

// Vaccine Market Contract
export const vaccineMarketContractAddress = "0xe36bfa5dd89d06b96a17f8b5260f431cf1510d9a";
export const vaccineConditionalTokensContractAddress = "0x8d27cbdf4c6786453049f3e559475f92029ad8e3";

// String Theory Market Contract
export const stringTheoryMarketContractAddress = "0xBCe88Dc45cb1fcA6BAb6ca8A679fAC8C36867274";
export const stringTheoryConditionalTokensContractAddress = "0x98e494185622e9b32A68BF1Ea3f7f876B87b9Aeb";

// COVID-19 mRNA Vaccine Market Contract
export const covidVaccineMarketContractAddress = "0x615ed9da950d81b949b6347275aed697f4407ba0";
export const covidVaccineConditionalTokensContractAddress = "0x89249c2039f8B993BeF96ED8c31244D512396b50";


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
        outcome1PositionId: "51877916418744962899164470202259177085298509683534003885170535231097280890835", // JFK Yes
        outcome2PositionId: "46634212102108699492488813922022044718165605089123703573217419428873160154565", // JFK No
      };
    case 'alien':
      return {
        marketContract: getContract({
          client,
          chain: polygonAmoy,
          address: alienMarketContractAddress,
        }),
        conditionalTokensContract: getContract({
          client,
          chain: polygonAmoy,
          address: alienConditionalTokensContractAddress,
        }),
        outcome1PositionId: "41454826355713373937139021826100554757622368884488368898497774336090889469140", // Yes
        outcome2PositionId: "113951986287197248873172744880628586517247093496821249052133686037677477393290", // No
      };
    case 'vaccine':
      return {
        marketContract: getContract({
          client,
          chain: polygonAmoy,
          address: vaccineMarketContractAddress,
        }),
        conditionalTokensContract: getContract({
          client,
          chain: polygonAmoy,
          address: vaccineConditionalTokensContractAddress,
        }),
        outcome1PositionId: "1257155754674438031181026416713588906880432630331959539463505490120135286275", // Yes
        outcome2PositionId: "427422523279616693430978097847445172951280684467936974405376794873337405734", // No
      };
    case 'string-theory':
      return {
        marketContract: getContract({
          client,
          chain: polygonAmoy,
          address: stringTheoryMarketContractAddress,
        }),
        conditionalTokensContract: getContract({
          client,
          chain: polygonAmoy,
          address: stringTheoryConditionalTokensContractAddress,
        }),
        outcome1PositionId: "32250025010013753686758004958601919769200256745991269713400032984229894989942", // Yes
        outcome2PositionId: "84975146528020239138226630472779657535836014231648771579957252081086807634274", // No
      };
    case 'covid-vaccine':
      return {
        marketContract: getContract({
          client,
          chain: polygonAmoy,
          address: covidVaccineMarketContractAddress,
        }),
        conditionalTokensContract: getContract({
          client,
          chain: polygonAmoy,
          address: covidVaccineConditionalTokensContractAddress,
        }),
        outcome1PositionId: "25711580668722501488911378138257500896567610032840626087583952341660751449239", // Yes
        outcome2PositionId: "31726574915684023644994761376015344955725332476487899337146128876191317137169", // No
      };
  }
}