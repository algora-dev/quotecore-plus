import { NextRequest, NextResponse } from 'next/server';
import { fetchCatalogRows } from '@/app/(auth)/[workspaceSlug]/components/catalog-actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { catalogId, limit } = body as { catalogId?: string; limit?: number };

    if (!catalogId) {
      return NextResponse.json({ ok: false, error: 'Missing catalogId.' }, { status: 400 });
    }

    const result = await fetchCatalogRows(catalogId, limit ?? 30000);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[catalog-rows] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
