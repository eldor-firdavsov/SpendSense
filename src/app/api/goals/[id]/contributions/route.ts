import { NextRequest, NextResponse } from 'next/server';
import { contributeToGoal } from '@/lib/goals/service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await contributeToGoal(id, body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ goal: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error contributing to goal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
