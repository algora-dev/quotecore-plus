import { NextRequest, NextResponse } from 'next/server';
import { importSupplierComponents } from '@/app/(auth)/[workspaceSlug]/supplier-directory/actions';
import { requireApiAuthentication } from '@/app/lib/auth/apiGuard';

export async function POST(req: NextRequest) {
  const authError = await requireApiAuthentication();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { sourceLibraryId, targetCollectionId, componentIds, alertsEnabled } = body as {
      sourceLibraryId?: string;
      targetCollectionId?: string;
      componentIds?: string[];
      alertsEnabled?: boolean;
    };

    if (!sourceLibraryId || !targetCollectionId || !Array.isArray(componentIds)) {
      return NextResponse.json(
        { ok: false, errors: ['Missing required fields.'] },
        { status: 400 }
      );
    }

    const result = await importSupplierComponents({
      sourceLibraryId,
      targetCollectionId,
      componentIds,
      alertsEnabled,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-import] Error:', err);
    return NextResponse.json(
      { ok: false, errors: ['Internal server error.'] },
      { status: 500 }
    );
  }
}
