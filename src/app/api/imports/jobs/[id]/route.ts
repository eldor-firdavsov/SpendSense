import { NextRequest, NextResponse } from 'next/server';
import { getImportJob } from '@/lib/imports/service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getImportJob(id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ job: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching import job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
