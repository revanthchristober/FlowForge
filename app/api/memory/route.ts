import { NextResponse } from 'next/server';
import { getAllMemory } from '@/lib/memory/store';

// Allow this route to use Node.js runtime to access fs
export const runtime = 'nodejs';

export async function GET() {
  try {
    const items = getAllMemory();
    return NextResponse.json({ items });
  } catch (error) {
    console.error('❌ Memory API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load memory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
