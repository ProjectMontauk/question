import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 Test endpoint hit! Server is working.');
  return NextResponse.json({ message: 'Test endpoint working!', timestamp: new Date().toISOString() });
}
