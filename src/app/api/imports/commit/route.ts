import { NextRequest, NextResponse } from 'next/server';
import { commitImport } from '@/lib/imports/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await commitImport(body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ result: result.data }, { status: result.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error committing import';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
