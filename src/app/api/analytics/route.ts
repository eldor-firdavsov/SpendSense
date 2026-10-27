import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsSummary } from '@/lib/analytics/service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const queryParams: Record<string, string> = {};

    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const result = await getAnalyticsSummary(queryParams);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ analytics: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
