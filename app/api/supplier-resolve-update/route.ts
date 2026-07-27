import { NextRequest, NextResponse } from 'next/server';
import { resolveSupplierUpdate } from '@/app/(auth)/[workspaceSlug]/supplier-directory/actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId, importedComponentId, status } = body as {
      notificationId?: string;
      importedComponentId?: string;
      status?: string;
    };

    if (!notificationId || !status) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields.' },
        { status: 400 }
      );
    }

    const validStatuses = ['dismissed', 'kept_local', 'archived'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, message: 'Invalid status.' },
        { status: 400 }
      );
    }

    const result = await resolveSupplierUpdate({
      notificationId,
      importedComponentId,
      status: status as 'dismissed' | 'kept_local' | 'archived',
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-resolve-update] Error:', err);
    return NextResponse.json(
      { ok: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
