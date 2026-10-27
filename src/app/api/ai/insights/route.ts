import { NextRequest, NextResponse } from 'next/server';
import { listInsights, generateAndSaveInsights } from '@/lib/ai/insightsService';
import type { InsightStatus } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') as InsightStatus | null;
    const result = await listInsights(status || undefined);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ insights: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching insights';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await generateAndSaveInsights();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error generating insights';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
