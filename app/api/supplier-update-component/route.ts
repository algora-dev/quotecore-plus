import { NextRequest, NextResponse } from 'next/server';
import { updateImportedComponent } from '@/app/(auth)/[workspaceSlug]/supplier-directory/actions';

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

    const result = await updateImportedComponent(importedComponentId, notificationId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-update-component] Error:', err);
    return NextResponse.json(
      { ok: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
