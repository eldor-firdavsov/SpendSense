import { NextRequest, NextResponse } from 'next/server';
import { getConversationMessages } from '@/lib/ai/advisorService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getConversationMessages(id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching messages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
