import { NextRequest, NextResponse } from 'next/server';
import { simulatePatientCount } from '@/app/lib/mockData';
import { Filter } from '@/app/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filters: Filter[] = body.filters || [];

    const patientCount = simulatePatientCount(filters);

    return NextResponse.json({
      patient_count: patientCount,
      filters_applied: filters.filter(f => f.enabled).length,
    });
  } catch (error) {
    console.error('Error calculating patient count:', error);
    return NextResponse.json(
      { error: 'Failed to calculate patient count' },
      { status: 500 }
    );
  }
}
