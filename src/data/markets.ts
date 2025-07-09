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
    outcomes: ["Yes, CIA involved in JFK's death", "No, CIA played no role in JFK's death"],
    rules: "The market will resolve 'Yes' if the CIA aided in the planning or execution of President John F. Kennedy's Assassination. This means that a group inside the CIA or a group receiving funding from the CIA participated in the planning/execution of the 35th President's assassination. Otherwise, the market will resolve 'No.' This means that no personnel inside or funded by the CIA aided in the assassination of John F. Kennedy."
  },
  {
    id: 'moon-landing',
    title: "Did the Apollo 11 Mission Land on the Moon?",
    description: "Did humans actually land on the moon?",
    image: "/Moon.png",
    contractAddress: "0x6d6892d6ba83bd9c21707aacbf45269d1211898e", // New contract
    outcomes: ["Yes, Moon Landing was real", "No, Moon Landing was fake"],
    rules: "The market will resolve 'Yes' if Neil Armstrong and Buzz Aldrin actually landed on the moon during the Apollo 11 mission in 1969. This means that Anerican astronauts physically walked on the lunar surface. Otherwise, the market will resolve 'No.' This means the moon landings were faked or staged."
  },
  {
    id: 'alien',
    title: "Have Aliens Visited Earth?",
    description: "Has intelligent extraterrestrial life visited Earth at any point in history?",
    image: "/Alien.png", // Update this path if you have a specific image
    contractAddress: "0x6186AB73d155CdFdcB18BC9c912469aE4c256129", // Alien market contract
    outcomes: ["Yes, aliens have visited Earth", "No, aliens have never visited Earth"],
    rules: "The market will resolve 'Yes' if credible evidence emerges, accepted by the scientific community, that intelligent extraterrestrial life has visited Earth at any point in history. Otherwise, the market will resolve 'No.' This means that no such evidence is accepted by the scientific community by the market's resolution date."
  },
  {
    id: 'vaccine',
    title: "Do Childhood Vaccines Cause Autism?",
    description: "Is there a causal relationship between vaccines and autism spectrum disorders?",
    image: "/Vaccine.png", // You'll need to add this image
    contractAddress: "0xe36bfa5dd89d06b96a17f8b5260f431cf1510d9a", // Vaccine market contract
    outcomes: ["Yes, vaccines cause autism", "No, vaccines do not cause autism"],
    rules: "The market will resolve 'Yes' if credible scientific evidence emerges, accepted by the medical and scientific community, that vaccines cause autism spectrum disorders. This means that a causal relationship between vaccination and autism is established through rigorous scientific research. Otherwise, the market will resolve 'No.' This means that no such causal relationship is established by the market's resolution date."
  },
  {
    id: 'string-theory',
    title: "Is String Theory a Failed Model?",
    description: "Has string theory been proven to be an unsuccessful approach to quantum gravity?",
    image: "/StringTheory.png", // You'll need to add this image
    contractAddress: "0xBCe88Dc45cb1fcA6BAb6ca8A679fAC8C36867274", // String theory market contract
    outcomes: ["Yes, string theory is a failed model", "No, string theory is not a failed model"],
    rules: "The market will resolve 'Yes' if the scientific community broadly accepts that string theory has failed as a viable approach to quantum gravity. This means that string theory is widely considered to be unsuccessful in providing a unified theory of physics. Otherwise, the market will resolve 'No.' This means that string theory remains a viable or promising approach to quantum gravity by the market's resolution date."
  },
  {
    id: 'covid-vaccine',
    title: "Are the COVID-19 MRNA Vaccinations Safe?",
    description: "Are the mRNA-based COVID-19 vaccines safe for human use?",
    image: "/CovidVaccine.png", // You'll need to add this image
    contractAddress: "0x615ed9da950d81b949b6347275aed697f4407ba0", // COVID vaccine market contract
    outcomes: ["Yes, COVID-19 mRNA vaccines are safe", "No, COVID-19 mRNA vaccines are not safe"],
    rules: "The market will resolve 'Yes' if the scientific and medical community broadly accepts that COVID-19 mRNA vaccines are safe for human use. This means that the vaccines are considered safe by regulatory authorities and the medical community. Otherwise, the market will resolve 'No.' This means that the vaccines are found to be unsafe or have significant safety concerns by the market's resolution date."
  }
];

export function getMarketById(id: string): Market | undefined {
  return markets.find(market => market.id === id);
}

export function getAllMarkets(): Market[] {
  return markets;
} 