export interface Market {
  id: string;
  title: string;
  description: string;
  image: string;
  contractAddress: string;
  outcomes: [string, string]; // [Yes outcome, No outcome]
  rules: string;
}

export const markets: Market[] = [
  {
    id: 'jfk',
    title: "CIA Involved in JFK Assassination?",
    description: "Did the CIA aid in the planning or execution of John F. Kennedy's Assassination?",
    image: "/JFKCar.png",
    contractAddress: "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a", // Your current market contract
    outcomes: ["Yes, CIA Involved", "No, CIA played no role"],
    rules: "The market will resolve 'Yes' if the CIA aided in the planning or execution of John F. Kennedy's Assassination. This means that a group inside the CIA or received funding from the CIA participated in the planning/execution of the 35th President's assassination. Otherwise, the market will resolve 'No.' This means that no personnel inside or funded by the CIA aided the murder of John F. Kennedy."
  },
  {
    id: 'moon-landing',
    title: "Moon Landing Conspiracy?",
    description: "Did humans actually land on the moon?",
    image: "/JFKCar.png", // Using same image for now
    contractAddress: "0x03d7fa2716c0ff897000e1dcafdd6257ecce943a", // Same contract for now
    outcomes: ["Yes, Moon Landing", "No, Moon Landing"],
    rules: "The market will resolve 'Yes' if humans actually landed on the moon during the Apollo missions. This means that astronauts physically walked on the lunar surface. Otherwise, the market will resolve 'No.' This means the moon landings were faked or staged."
  }
];

export function getMarketById(id: string): Market | undefined {
  return markets.find(market => market.id === id);
}

export function getAllMarkets(): Market[] {
  return markets;
} 