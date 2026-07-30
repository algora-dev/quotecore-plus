import { NextRequest, NextResponse } from 'next/server';
import { convertSelectedRowsToComponents } from '@/app/(auth)/[workspaceSlug]/supplier/catalogue-actions';
import { requireApiAuthentication } from '@/app/lib/auth/apiGuard';

export async function POST(req: NextRequest) {
  const authError = await requireApiAuthentication();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { targetCollectionId, selectedRows, columnMapping } = body as {
      targetCollectionId?: string;
      selectedRows?: Record<string, string>[];
      columnMapping?: Record<string, string[]>;
    };

    if (!targetCollectionId || !Array.isArray(selectedRows) || !columnMapping) {
      return NextResponse.json(
        { ok: false, errors: ['Missing required fields.'] },
        { status: 400 },
      );
    }

    const result = await convertSelectedRowsToComponents({
      targetCollectionId,
      selectedRows,
      columnMapping,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-catalogue-convert] Error:', err);
    return NextResponse.json(
      { ok: false, errors: ['Internal server error.'] },
      { status: 500 },
    );
  }
}
