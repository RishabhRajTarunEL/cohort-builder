import { NextRequest, NextResponse } from 'next/server';
import { generateDemographicsData } from '@/app/lib/mockData';
import { Filter } from '@/app/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filters: Filter[] = body.filters || [];

    const demographics = generateDemographicsData(filters);

    return NextResponse.json(demographics);
  } catch (error) {
    console.error('Error fetching demographics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch demographics data' },
      { status: 500 }
    );
  }
}
