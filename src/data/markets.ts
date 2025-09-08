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
    rules: "The market will resolve 'Yes' if current or former CIA personnel aided in the planning or execution of President John F. Kennedy's Assassination. Otherwise, the market will resolve 'No.' This means that no current or former CIA personnel participated in John F. Kennedy's assassination. The market will resolve as soon as verifiable evidence or consensus emerges after the discovery period ends on March 8th, 2026."

  },
  {
    id: 'moon-landing',
    title: "Is the Apollo 11 Moon Landing Fake?",
    description: "Did humans actually land on the moon?",
    image: "/Moon.png",
    contractAddress: "0xeeaca4019f25e573c33a0de266ba0d1020932cc9", // Moon Landing Market Contract on Base
    outcomes: ["Yes, Moon Landing was Fake", "No, Moon Landing was real"],
    rules: "The market will resolve 'Yes' if Neil Armstrong and Buzz Aldrin physically walked on the moon during the Apollo 11 mission in 1969. Otherwise, the market will resolve 'No.' This means that the Apollo 11 moon landings were faked, staged, or exaggerated to an extent where the Apollo 11 Crew never walked on the moon. The market will resolve as soon as verifiable evidence or consensus emerges after the discovery period ends on March 8th, 2026."
  },
  {
    id: 'bridgitte-macron',
    title: "Bridgitte Macron Born a Man?",
    description: "Was Bridgitte Macron born a man?",
    image: "/Macron.png",
    contractAddress: "0x1fef92c81b4ef16b099330d5cb5981b8bfc69383", // Bridgitte Macron Market Contract on Base
    outcomes: ["Yes, Bridgitte Macron was born a man", "No, Bridgitte Macron was born a female"],
    rules: "The market will resolve 'Yes' if Bridgitte Macron, the First-Lady of France, was born a man with XY chromosomes. Otherwise, the market will resolve 'No.' This means that Bridgitte Macron was born a female with XX chromosomes or some other non-male combination. The market will resolve as soon as verifiable evidence or consensus emerges after the discovery period ends on March 8th, 2026."
  },
  {
    id: 'vaccines-autism',
    title: "Childhood Vaccines Cause Autism?",
    description: "Do childhood vaccines cause autism?",
    image: "/RFK.png", // Placeholder image until we add the actual photo
    contractAddress: "0x9db8664c16dcffb5b1bb8cde365fd174d46b3c25", // Vaccines Autism Market Contract on Base
    outcomes: ["Yes, childhood vaccines cause autism", "No, childhood vaccines do not cause autism"],
    rules: "The market will resolve 'Yes' if the CDC recommended childhood vaccine schedule (as of July 2nd, 2025) causes a statistically significant increase in Autism for vaccinated children vs unvaccinated children. Otherwise, the market will resolve 'No.' This means that following the CDC recommended vaccine schedule does not produce a statistically significant increase in Autism for vaccinated children vs unvaccinated children. The market will resolve as soon as verifiable evidence or consensus emerges after the discovery period ends on March 8th, 2026."
  },
  {
    id: 'trump-epstein',
    title: "Trump, an Epstein Pedophile?",
    description: "Did Trump engage in inappropriate sexual relations with a minor, likely in association with Jeffrey Epstein?",
    image: "/TrumpEpstein.png", // Placeholder image - you'll need to add this image
    contractAddress: "0xbf7b301d6b0542f2b69da5816eda102bbcc2aaf2", // Trump Epstein Market Contract on Base
    outcomes: ["Yes, Trump a pedophile", "No, Trump not a pedophile"],
    rules: "The market will resolve 'Yes' if Donald Trump engaged in inappropriate sexual relations with a minor, likely in association with Jeffrey Epstein. Otherwise, the market will resolve 'No.' This means that Donald Trump did not engage in inappropriate sexual relations with a minor in association with Jeffrey Epstein. The market will resolve as soon as verifiable evidence or consensus emerges after the discovery period ends on March 8th, 2026."
  },
  {
    id: 'mrna-turbocancer',
    title: "MRNA Vax Cause Cancer?",
    description: "Do COVID-19 MRNA vaccinations cause turbo cancers?",
    image: "/MRNATurboCancer.png", // Placeholder image - you'll need to add this image
    contractAddress: "0xdc57601061c30DCdFbE849e2440CC36A929C7205", // MRNA TurboCancer Market Contract on Base
    outcomes: ["Yes, MRNA vax cause cancer", "No, MRNA vax do not cause cancer"],
    rules: "The market will resolve 'Yes' if the COVID-19 MRNA vaccinations produce a statistically significant increase in Cancers in vaccinated individuals vs unvaccinated. Otherwise, the market will resolve 'No.' This means that the COVID-19 MRNA vaccinations do not cause a statistically significant increase in cancers across vaccinated and unvaccinated individuals. The market will resolve as soon as verifiable evidence or consensus emerges after the discovery period ends on March 8th, 2026."
  }
];

export function getMarketById(id: string): Market | undefined {
  return markets.find(market => market.id === id);
}

export function getAllMarkets(): Market[] {
  return markets;
} 