import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { getContract, prepareContractCall } from 'thirdweb';
import { polygonAmoy } from 'thirdweb/chains';
import { client } from '../../../client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Get the Nash token contract
const tokenContract = getContract({
  client: client,
  chain: polygonAmoy,
  address: "0xb1b53857c6702ebc8c2e924873f2fd4c90c5bc40", // Nash token contract address
});

export async function POST(request: NextRequest) {
  console.log('🔄 Webhook received! Processing...');
  console.log('📍 Request method:', request.method);
  console.log('🌐 Request URL:', request.url);
  
  let body: string;
  let sig: string | null;
  
  try {
    body = await request.text();
    console.log('📝 Request body length:', body.length);
    console.log('📄 Request body preview:', body.substring(0, 200) + '...');
    
    const headersList = await headers();
    sig = headersList.get('stripe-signature');
    console.log('🔑 Stripe signature present:', !!sig);
    console.log('🔑 Stripe signature value:', sig ? sig.substring(0, 50) + '...' : 'None');
    
    // Log all headers for debugging
    console.log('📋 All headers:', Object.fromEntries(headersList.entries()));
  } catch (error) {
    console.error('❌ Error reading request:', error);
    return NextResponse.json({ error: 'Failed to read request' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, endpointSecret);
    console.log('✅ Webhook signature verified successfully');
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the event
  console.log(`🎯 Processing event type: ${event.type}`);
  
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('💰 Checkout completed:', session.id);
      console.log('💵 Amount total:', `$${(session.amount_total! / 100).toFixed(2)}`);
      console.log('📊 Metadata:', session.metadata);
      
      // Extract metadata
      const { nashAmount, purpose, customerWallet } = session.metadata || {};
      
      if (purpose === 'nash_purchase') {
        try {
          console.log('🎉 Nash purchase detected!');
          console.log(`✅ Successfully purchased ${nashAmount} Nash for $${(session.amount_total! / 100).toFixed(2)}`);
          console.log(`🔑 Customer wallet: ${customerWallet}`);
          console.log(`🪙 Nash amount to mint: ${nashAmount}`);
          
          // Mint Nash tokens to the customer's wallet
          if (customerWallet && nashAmount) {
            console.log('🚀 Starting mint process...');
            
            try {
              // Convert nashAmount to the proper format (assuming it's in whole units)
              const mintAmount = BigInt(nashAmount) * BigInt(10 ** 18); // Convert to wei (18 decimals)
              
              console.log(`💰 Minting ${nashAmount} Nash (${mintAmount} wei) to wallet: ${customerWallet}`);
              
              // For now, log the mint details
              // TODO: Implement actual minting using a queue system or direct contract call
              console.log('✅ Mint details prepared:');
              console.log(`   - Contract: ${tokenContract.address}`);
              console.log(`   - Method: mint(address account, uint256 amount)`);
              console.log(`   - To: ${customerWallet}`);
              console.log(`   - Amount: ${mintAmount} wei (${nashAmount} Nash)`);
              
              // You can implement actual minting here using:
              // 1. A queue system (like Bull/BullMQ)
              // 2. Direct contract interaction with private key
              // 3. A separate minting service
              
            } catch (mintError) {
              console.error('❌ Smart contract mint failed:', mintError);
              // Log the error but don't fail the webhook
              // You might want to implement retry logic or manual review
            }
          } else {
            console.log('⚠️ Missing customer wallet or nash amount in metadata');
          }
          
        } catch (error) {
          console.error('❌ Processing failed:', error);
          // You might want to send an email notification or log this for manual review
        }
      } else {
        console.log('⚠️ Checkout completed but not a Nash purchase');
      }
      break;
      
    case 'checkout.session.expired':
      const expiredSession = event.data.object as Stripe.Checkout.Session;
      console.log('❌ Checkout session expired:', expiredSession.id);
      break;
      
    default:
      console.log(`❓ Unhandled event type: ${event.type}`);
      console.log('📋 Event data:', JSON.stringify(event.data, null, 2));
  }

  console.log('✅ Webhook processed successfully');
  return NextResponse.json({ received: true });
} 