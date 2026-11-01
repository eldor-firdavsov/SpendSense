import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserFinancialTimeline } from '@/lib/timeline/financialTimeline';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const timeline = await getUserFinancialTimeline(user.id, supabase);

    return NextResponse.json(timeline, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching financial timeline';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
