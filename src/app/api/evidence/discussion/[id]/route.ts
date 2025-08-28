import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const evidenceId = parseInt(id);
    
    if (isNaN(evidenceId)) {
      return NextResponse.json({ error: 'Invalid evidence ID' }, { status: 400 });
    }

    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
    }

    return NextResponse.json(evidence);
  } catch (error) {
    console.error('Error fetching evidence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 