import { NextRequest, NextResponse } from 'next/server';
import { importCatalogueComponents } from '@/app/(auth)/[workspaceSlug]/supplier/catalogue-actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetCollectionId, rows } = body as {
      targetCollectionId?: string;
      rows?: Array<{ sku: string; name: string; price: number; product_type: string; notes: string }>;
    };

    if (!targetCollectionId || !Array.isArray(rows)) {
      return NextResponse.json(
        { ok: false, errors: ['Missing required fields.'] },
        { status: 400 }
      );
    }

    const result = await importCatalogueComponents({ targetCollectionId, rows });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-catalogue-import] Error:', err);
    return NextResponse.json(
      { ok: false, errors: ['Internal server error.'] },
      { status: 500 }
    );
  }
}
