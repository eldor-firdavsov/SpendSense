import { NextResponse } from 'next/server';
import { listAIConversations } from '@/lib/ai/advisorService';

export async function GET() {
  try {
    const result = await listAIConversations();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ conversations: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching conversations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
