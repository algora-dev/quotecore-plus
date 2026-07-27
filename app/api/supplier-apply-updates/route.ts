import { NextRequest, NextResponse } from 'next/server';
import { applySupplierUpdates } from '@/app/(auth)/[workspaceSlug]/supplier-directory/actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { selections } = body as {
      selections?: Array<{ notificationId: string; importedComponentId: string; fields: string[] }>;
    };

    if (!Array.isArray(selections)) {
      return NextResponse.json(
        { ok: false, message: 'Missing selections array.' },
        { status: 400 }
      );
    }

    const results = await applySupplierUpdates(selections);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('[supplier-apply-updates] Error:', err);
    return NextResponse.json(
      { ok: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
