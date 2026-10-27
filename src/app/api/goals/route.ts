import { NextRequest, NextResponse } from 'next/server';
import { listGoals, createGoal } from '@/lib/goals/service';

export async function GET() {
  try {
    const result = await listGoals();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ goals: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching goals';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createGoal(body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ goal: result.data }, { status: result.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error creating goal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
