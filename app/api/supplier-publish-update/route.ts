import { NextRequest, NextResponse } from 'next/server';
import { publishLibraryUpdate } from '@/app/(auth)/[workspaceSlug]/supplier-directory/actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { libraryId } = body as { libraryId?: string };

    if (!libraryId) {
      return NextResponse.json(
        { ok: false, message: 'Missing libraryId.' },
        { status: 400 }
      );
    }

    const result = await publishLibraryUpdate(libraryId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[supplier-publish-update] Error:', err);
    return NextResponse.json(
      { ok: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
