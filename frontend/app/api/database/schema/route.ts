import { NextResponse } from 'next/server';
import { mockDatabaseSchema } from '@/app/lib/mockData';

export async function GET() {
  try {
    return NextResponse.json({
      tables: mockDatabaseSchema,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch database schema' },
      { status: 500 }
    );
  }
}
