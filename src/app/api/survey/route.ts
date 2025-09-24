import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const answers = body?.answers ?? {};
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = (request.headers.get('x-forwarded-for') || '').split(',')[0] || undefined;

    // Helper function to concatenate selected answers
    const getSelectedAnswers = (prefix: string, options: string[]) => {
      return options
        .filter(option => answers[`${prefix}_${option}`] === "true")
        .join(", ");
    };

    // Question 1: User type
    const userTypeOptions = [
      "Political Junkie",
      "Quant - looking for an edge", 
      "Gambler",
      "Passive Viewer that enjoys the information produced"
    ];
    const userType = getSelectedAnswers("userType", userTypeOptions);

    // Question 2: Topics of interest
    const topicOptions = [
      "CIA Involved in JFK Assassination?",
      "Is the Apollo 11 Moon Landing Fake?",
      "Bridgitte Macron born a man?",
      "Childhood Vaccines Linked to Autism?",
      "Is Trump an Epstein-Pedophile?",
      "mRNA Vax Linked to Cancer?",
      "mRNA Vax Linked to Fertility Decline?",
      "Is Jeffrey Epstein an Asset of US/Israeli Intelligence?"
    ];
    const topicsOfInterest = getSelectedAnswers("topic", topicOptions);

    // Question 3: Expert commission
    const expertCommission = getSelectedAnswers("expertCommission", ["Yes", "No"]);

    // Question 4: Market resolution method
    const resolutionOptions = [
      "No market resolution - fully liquid market where you could buy/sell based on market prices forever - let the market decide price forever?",
      "Market resolution once \"overwhelming evidence is established\" - a panel of independent experts would be called to make a judgement after it was deemed there was enough evidence to prove \"beyond a reasonable doubt\" that one side was true?",
      "Market resolution after a certain time frame - a panel of independent experts would be called to make a judgement after a one-year or six-month discovery period is over."
    ];
    const marketResolutionMethod = getSelectedAnswers("resolutionMethod", resolutionOptions);

    // Question 5: Inconclusive evidence handling
    const inconclusiveOptions = [
      "Freeze current market odds and redeem at the market price. If the market says 85% yes, yes share holders redeem at 85%?",
      "Return everybody's money still in the market regardless of current prices",
      "Allow the market to continue running until there was another trial called to settle the market!"
    ];
    const inconclusiveEvidenceHandling = getSelectedAnswers("inconclusiveEvidence", inconclusiveOptions);

    // Question 6: View evidence before betting
    const viewEvidenceBeforeBetting = getSelectedAnswers("viewMarketInfo", ["Yes", "No"]);

    // Question 7: Contribute to information
    const contributeToInformation = getSelectedAnswers("contributeInfo", ["Yes", "No"]);

    // Question 8: Trust evidence rating (single selection)
    const trustEvidenceRating = answers.trustEvidence || null;

    // Question 9: Televised trial
    const televisedTrialInterest = getSelectedAnswers("televisedTrial", ["Yes", "No"]);

    // Question 10: Expert report
    const expertReportPreference = getSelectedAnswers("expertReport", ["Yes", "No"]);

    // Question 11: Expert class preference
    const expertClassOptions = [
      "Professors of History or Science at Elite Institutions - Stanford, Harvard, UPenn, etc",
      "Professors of History or Science at Big Research Universities - Iowa, Florida, Nebraska, or Montana",
      "Professors of History or Science at Military Colleges - West Point, Air Force, The Citadel, etc",
      "European Professors of History or Science at Respected Institutions",
      "Practitioners - Doctors for medical questions & Published Historians for historical questions",
      "Jury of Peers - draft random users given they are college educated and employed",
      "Amish People",
      "A Bi-Partisan Congressional Committee",
      "Celebrities"
    ];
    const expertClassPreference = getSelectedAnswers("expertClass", expertClassOptions);

    const created = await prisma.surveyResponse.create({
      data: {
        name: answers.name || null,
        sessionId: body.sessionId || null,
        walletAddress: body.walletAddress || null,
        userType: userType || null,
        topicsOfInterest: topicsOfInterest || null,
        otherTopics: answers.otherTopics || null,
        expertCommission: expertCommission || null,
        marketResolutionMethod: marketResolutionMethod || null,
        inconclusiveEvidenceHandling: inconclusiveEvidenceHandling || null,
        viewEvidenceBeforeBetting: viewEvidenceBeforeBetting || null,
        contributeToInformation: contributeToInformation || null,
        trustEvidenceRating: trustEvidenceRating,
        televisedTrialInterest: televisedTrialInterest || null,
        expertReportPreference: expertReportPreference || null,
        expertClassPreference: expertClassPreference || null,
        additionalComments: answers.additionalComments || null,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });
    const response = NextResponse.json({ id: created.id, createdAt: created.createdAt });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  } catch (err) {
    console.error('Survey POST error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  const response = NextResponse.json({ ok: true });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}



