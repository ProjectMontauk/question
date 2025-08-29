import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  try {
    const { amount, nashAmount, customerWallet } = await request.json();
    
    console.log('🔍 API Route - Received data:', { amount, nashAmount, customerWallet });

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

    // Price map for existing Stripe products
    const priceMap: { [key: number]: string } = {
      10: 'price_1S0kx5GYPawnv17VzhESgC00',    // 250 Nash for $10
      20: 'price_1S0kxQGYPawnv17VBgyBxniG',    // 500 Nash for $20 (you'll need to create this)
      30: 'price_1S0kxmGYPawnv17Vv8PYA3A0',    // 750 Nash for $30 (you'll need to create this)
      40: 'price_1S0kyTGYPawnv17V6zYBK1rC',    // 1000 Nash for $40 (you'll need to create this)
    };

    // Validate that we have a price for this amount
    if (!priceMap[amount]) {
      return NextResponse.json(
        { error: `No price configured for amount $${amount}` },
        { status: 400 }
      );
    }

    const selectedPriceId = priceMap[amount];
    console.log('💰 Selected Price ID:', {
      amount: `$${amount}`,
      nashAmount: nashAmount,
      priceId: selectedPriceId,
    });

    console.log('🚀 Creating Stripe Checkout Session with metadata:', {
      nashAmount: nashAmount.toString(),
      purpose: 'nash_purchase',
      customerWallet: customerWallet,
    });

    // Create a Checkout Session with metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: selectedPriceId, // Use the selected price ID
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/confirmation?success=true&nashAmount=${nashAmount}&customerWallet=${customerWallet}&purchaseAmount=${amount}`,
      cancel_url: `${request.headers.get('origin')}/deposit?canceled=true`,
      metadata: {
        nashAmount: nashAmount.toString(),
        purpose: 'nash_purchase',
        customerWallet: customerWallet,
        purchaseAmount: amount.toString(),
      },
    });

    console.log('✅ Stripe Checkout Session created:', {
      sessionId: session.id,
      metadata: session.metadata,
      url: session.url,
    });

    // Return the session URL for redirect
    return NextResponse.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: error.statusCode || 500 }
    );
  }
} 