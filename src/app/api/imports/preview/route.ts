import { NextRequest, NextResponse } from 'next/server';
import { previewImport } from '@/lib/imports/service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mappingRaw = formData.get('mapping') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Limit file size to 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    const filename = file.name;
    const lowerName = filename.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload a .csv, .xlsx, or .xls file.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let userMapping = undefined;
    if (mappingRaw) {
      try {
        userMapping = JSON.parse(mappingRaw);
      } catch {
        return NextResponse.json({ error: 'Invalid mapping JSON format' }, { status: 400 });
      }
    }

    const result = await previewImport(buffer, filename, userMapping);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ preview: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error previewing import';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
