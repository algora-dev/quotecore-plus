import { NextRequest, NextResponse } from 'next/server';
import { fetchCatalogRowsForConversion } from '@/app/(auth)/[workspaceSlug]/supplier/catalogue-actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { catalogId, limit } = body as { catalogId?: string; limit?: number };

    if (!catalogId) {
      return NextResponse.json({ ok: false, error: 'Missing catalogId.' }, { status: 400 });
    }

    const result = await fetchCatalogRowsForConversion(catalogId, limit ?? 500);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-catalogue-rows] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
