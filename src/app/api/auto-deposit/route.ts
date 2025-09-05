import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.thecitizen.io',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Check if this wallet has already received an auto-deposit
    const existingAutoDeposit = await prisma.autoDeposit.findUnique({
      where: {
        walletAddress: walletAddress.toLowerCase(),
      },
    });

    return NextResponse.json({
      hasReceivedAutoDeposit: !!existingAutoDeposit,
      autoDeposit: existingAutoDeposit,
    });
  } catch (error: unknown) {
    console.error('Error checking auto-deposit status:', error);
    return NextResponse.json(
      { error: 'Failed to check auto-deposit status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, amount, transactionHash } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
    }

    // Check if this wallet has already received an auto-deposit
    const existingAutoDeposit = await prisma.autoDeposit.findUnique({
      where: {
        walletAddress: walletAddress.toLowerCase(),
      },
    });

    if (existingAutoDeposit) {
      return NextResponse.json(
        { error: 'Auto-deposit already exists for this wallet' },
        { status: 400 }
      );
    }

    // Create new auto-deposit record
    const autoDeposit = await prisma.autoDeposit.create({
      data: {
        walletAddress: walletAddress.toLowerCase(),
        amount: amount,
        transactionHash: transactionHash || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Auto-deposit recorded successfully',
      autoDeposit,
    });
  } catch (error: unknown) {
    console.error('Error recording auto-deposit:', error);
    return NextResponse.json(
      { error: 'Failed to record auto-deposit' },
      { status: 500 }
    );
  }
}
