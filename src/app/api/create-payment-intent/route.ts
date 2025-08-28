import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export async function POST(request: NextRequest) {
  try {
    const { amount, nashAmount, customerWallet } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (!customerWallet) {
      return NextResponse.json(
        { error: 'Customer wallet address is required' },
        { status: 400 }
      );
    }

    // Create a Checkout Session with metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${nashAmount} Nash (𐆖)`,
            description: 'In-game currency for prediction markets',
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/deposit?success=true&amount=${nashAmount}`,
      cancel_url: `${request.headers.get('origin')}/deposit?canceled=true`,
      metadata: {
        nashAmount: nashAmount.toString(),
        purpose: 'nash_purchase',
        customerWallet: customerWallet,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
} 