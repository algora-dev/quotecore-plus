import { NextRequest, NextResponse } from 'next/server';
import { updateSupplierAlertPreference, getSupplierSubscriptions } from '@/app/(auth)/[workspaceSlug]/supplier-directory/actions';
import { requireApiAuthentication } from '@/app/lib/auth/apiGuard';

export async function GET() {
  const authError = await requireApiAuthentication();
  if (authError) return authError;

  try {
    const subscriptions = await getSupplierSubscriptions();
    return NextResponse.json({ ok: true, subscriptions });
  } catch (err) {
    console.error('[supplier-alert-preferences] GET error:', err);
    return NextResponse.json(
      { ok: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireApiAuthentication();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { sourceLibraryId, alertsEnabled, fieldPreferences } = body as {
      sourceLibraryId?: string;
      alertsEnabled?: boolean;
      fieldPreferences?: Record<string, boolean> | null;
    };

    if (!sourceLibraryId || typeof alertsEnabled !== 'boolean') {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields.' },
        { status: 400 }
      );
    }

    const result = await updateSupplierAlertPreference(
      sourceLibraryId,
      alertsEnabled,
      fieldPreferences === undefined ? undefined : fieldPreferences,
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-alert-preferences] POST error:', err);
    return NextResponse.json(
      { ok: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
