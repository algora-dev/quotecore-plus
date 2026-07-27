// DEPRECATED: This route is replaced by /api/supplier-apply-updates
// Kept as a thin wrapper for backward compatibility during transition.
// Will be removed once all callers use the new route.

import { NextRequest, NextResponse } from 'next/server';
import { applySupplierUpdates } from '@/app/(auth)/[workspaceSlug]/supplier-directory/actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { importedComponentId, notificationId } = body as {
      importedComponentId?: string;
      notificationId?: string;
    };

    if (!importedComponentId || !notificationId) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields.' },
        { status: 400 }
      );
    }

    // Delegate to new action - apply all changed fields
    const { SYNC_FIELDS } = await import('@/app/lib/supabase/sync-fields');
    const results = await applySupplierUpdates([{
      notificationId,
      importedComponentId,
      fields: [...SYNC_FIELDS],
    }]);

    const key = `${notificationId}:${importedComponentId}`;
    const result = results[key];
    return NextResponse.json(result ?? { ok: false, message: 'No result.' }, { status: result?.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-update-component] Error:', err);
    return NextResponse.json(
      { ok: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
