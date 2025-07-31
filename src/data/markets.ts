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
    outcomes: ["Yes, CIA involved in JFK's death", "No, CIA innocent in JFK's death"],
    rules: "The market will resolve 'Yes' if current or former CIA personnel aided in the planning or execution of President John F. Kennedy's Assassination. Otherwise, the market will resolve 'No.' This means that no current or former CIA personnel or a group receiving funding from the CIA participated in John F. Kennedy's assassination."
  },
  {
    id: 'moon-landing',
    title: "Is the Apollo 11 Moon Landing Fake?",
    description: "Did humans actually land on the moon?",
    image: "/Moon.png",
    contractAddress: "0x6d6892d6ba83bd9c21707aacbf45269d1211898e", // New contract
    outcomes: ["Yes, Moon Landing was Fake", "No, Moon Landing was real"],
    rules: "The market will resolve 'Yes' if Neil Armstrong and Buzz Aldrin physically walked on the moon during the Apollo 11 mission in 1969. Otherwise, the market will resolve 'No.' This means that the Apollo 11 moon landings were faked, staged, or exaggerated to an extent where the Apollo 11 Crew never walked on the moon."
  },
  {
    id: 'alien',
    title: "Has the U.S. Gov Made Contact with Aliens?",
    description: "Has intelligent extraterrestrial life visited Earth at any point in history?",
    image: "/Alien.png", // Update this path if you have a specific image
    contractAddress: "0x6186AB73d155CdFdcB18BC9c912469aE4c256129", // Alien market contract
    outcomes: ["Yes, U.S. gov made contact", "No, U.S. gov never made contact"],
    rules: "The market will resolve 'Yes' if the United States Government has ever made contact with Aliens, possesses Alien spacecraft, or discovered Alien biological material. Otherwise, the market will resolve 'No.' This means that the U.S. Government has never made contact with Aliens, possessed Alien spacecraft, or discovered Alien biological material." 
  },
  {
    id: 'vaccine',
    title: "Do Childhood Vaccines Cause Autism?",
    description: "Is there a causal relationship between vaccines and autism spectrum disorders?",
    image: "/Vaccine.png", // You'll need to add this image
    contractAddress: "0xe36bfa5dd89d06b96a17f8b5260f431cf1510d9a", // Vaccine market contract
    outcomes: ["Yes, vaccines cause autism", "No, vaccines are safe"],
    rules: "The market will resolve 'Yes' if the CDC recommended childhood vaccine schedule (as of July 2nd, 2025) causes a statistically significant increase in Autism for vaccinated children vs unvaccinated children. Otherwise, the market will resolve 'No.' This means that following the CDC recommended vaccine schedule does not produce a statisticallly significant increase in Autism for vaccinated children vs unvaccinated children."
  },
  {
    id: 'string-theory',
    title: "Is String Theory a Failed Model?",
    description: "Has string theory been proven to be an unsuccessful approach to quantum gravity?",
    image: "/StringTheory.png", // You'll need to add this image
    contractAddress: "0xBCe88Dc45cb1fcA6BAb6ca8A679fAC8C36867274", // String theory market contract
    outcomes: ["Yes, string theory is a failure", "No, string theory is a success"],
    rules: "The market will resolve 'Yes' if string theory is not a useful model for predicting real world phenomena that can be experimentally verified, thus a failed model in physics. Otherwise, the market will resolve 'No.' This means that string theory is a useful model for predicting real-world phenomena that can be experimentally verified."
  },
  {
    id: 'covid-vaccine',
    title: "Are COVID-19 MRNA Vaccinations Dangerous?",
    description: "Are the mRNA-based COVID-19 vaccines safe for human use?",
    image: "/CovidVaccine.png", // You'll need to add this image
    contractAddress: "0x615ed9da950d81b949b6347275aed697f4407ba0", // COVID vaccine market contract
    outcomes: ["Yes, mRNA vax is dangerous", "No, mRNA vax is safe"],
    rules: "The market will resolve 'Yes' if the Pfizer/Moderna mRNA-based COVID-19 vaccines (BNT162b2/mRNA-1273) significantly increase the risk of serious long-term adverse events relative to placebo. Otherwise, the market will resolve 'No.' This means that the Pfizer/Moderna mRNA-based COVID-19 vaccines (BNT162b2/mRNA-1273) do not significantly increase the risk of serious long-term adverse events."
  },
  {
    id: 'jesus',
    title: "Did Jesus Physically Exist?",
    description: "Did Jesus of Nazareth exist as a historical person?",
    image: "/Jesus.png", // You'll need to add this image
    contractAddress: "0x6ab2a19ad08c2077608d19f553D99948C48E4733", // Jesus market contract
    outcomes: ["Yes, Jesus physically existed", "No, Jesus did not physically exist"],
    rules: "The market will resolve 'Yes' if Jesus of Nazareth existed as a historical person who lived in the 1st century CE in the region of Judea. Otherwise, the market will resolve 'No.' This means that Jesus of Nazareth was not a real historical person who lived in the 1st century CE in the region of Judea."
  }
];

export function getMarketById(id: string): Market | undefined {
  return markets.find(market => market.id === id);
}

export function getAllMarkets(): Market[] {
  return markets;
} 