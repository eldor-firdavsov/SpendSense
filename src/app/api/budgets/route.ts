import { NextRequest, NextResponse } from 'next/server';
import { listBudgets, createBudget } from '@/lib/budgets/service';

export async function GET() {
  try {
    const result = await listBudgets();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ budgets: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching budgets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createBudget(body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ budget: result.data }, { status: result.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error creating budget';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
