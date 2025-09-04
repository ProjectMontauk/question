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
    contractAddress: "0xa015eBbaB5c6db0748a504ea71589BE21B2Cbe22", // JFK Market Contract on Base
    outcomes: ["Yes, CIA involved in JFK's death", "No, CIA innocent in JFK's death"],
    rules: "The market will resolve 'Yes' if current or former CIA personnel aided in the planning or execution of President John F. Kennedy's Assassination. Otherwise, the market will resolve 'No.' This means that no current or former CIA personnel or a group receiving funding from the CIA participated in John F. Kennedy's assassination."
  },
  {
    id: 'moon-landing',
    title: "Is the Apollo 11 Moon Landing Fake?",
    description: "Did humans actually land on the moon?",
    image: "/Moon.png",
    contractAddress: "0xeeaca4019f25e573c33a0de266ba0d1020932cc9", // Moon Landing Market Contract on Base
    outcomes: ["Yes, Moon Landing was Fake", "No, Moon Landing was real"],
    rules: "The market will resolve 'Yes' if Neil Armstrong and Buzz Aldrin physically walked on the moon during the Apollo 11 mission in 1969. Otherwise, the market will resolve 'No.' This means that the Apollo 11 moon landings were faked, staged, or exaggerated to an extent where the Apollo 11 Crew never walked on the moon."
  },
  {
    id: 'bridgitte-macron',
    title: "Bridgitte Macron Born a Man?",
    description: "Was Bridgitte Macron born a man?",
    image: "/Macron.png",
    contractAddress: "0x1fef92c81b4ef16b099330d5cb5981b8bfc69383", // Bridgitte Macron Market Contract on Base
    outcomes: ["Yes, Bridgitte Macron was born a man", "No, Bridgitte Macron was born a female"],
    rules: "The market will resolve 'Yes' if Bridgitte Macron was born a man. The market will resolve 'No' if Bridgitte Macron was born a female."
  }
];

export function getMarketById(id: string): Market | undefined {
  return markets.find(market => market.id === id);
}

export function getAllMarkets(): Market[] {
  return markets;
} 