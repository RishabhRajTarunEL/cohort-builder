import { NextRequest, NextResponse } from 'next/server';
import { generateDiagnosisData } from '@/app/lib/mockData';
import { Filter } from '@/app/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filters: Filter[] = body.filters || [];

    const diagnoses = generateDiagnosisData(filters);

    return NextResponse.json(diagnoses);
  } catch (error) {
    console.error('Error fetching diagnoses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch diagnosis data' },
      { status: 500 }
    );
  }
}
