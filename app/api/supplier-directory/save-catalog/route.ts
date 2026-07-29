import { NextRequest, NextResponse } from 'next/server';
import { saveSupplierCatalog } from '@/app/(auth)/[workspaceSlug]/supplier-directory/actions';

export async function POST(req: NextRequest) {
  try {
    const { catalogId } = await req.json();
    if (!catalogId || typeof catalogId !== 'string') {
      return NextResponse.json({ ok: false, message: 'Missing catalogId' }, { status: 400 });
    }

    const result = await saveSupplierCatalog(catalogId);

    if (result.ok) {
      return NextResponse.json({ ok: true, newCatalogId: result.newCatalogId });
    } else {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
