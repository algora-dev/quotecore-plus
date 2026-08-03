import { NextResponse } from 'next/server';
import { loadPublishedTakeoffLibrary, loadPublishedTakeoffLibraryBySlug } from '@/app/lib/supplier-pricing/publishedTakeoffLibrary';

/**
 * GET /api/free-tools/supplier-library/[slug]
 *
 * Returns the full published takeoff library for a supplier.
 * Includes all component options per slot + defaults.
 *
 * Query params:
 * - version: optional published version (defaults to latest live)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const version = url.searchParams.get('version');
  const versionNum = version ? parseInt(version, 10) : undefined;

  try {
    const library = await loadPublishedTakeoffLibraryBySlug(slug);

    if (!library) {
      return NextResponse.json({ error: 'Supplier library not found or not ready' }, { status: 404 });
    }

    // If version specified, reload with snapshot
    if (versionNum) {
      const versionedLib = await loadPublishedTakeoffLibrary(library.collectionId, versionNum);
      if (!versionedLib) {
        return NextResponse.json({ error: 'Library version not found' }, { status: 404 });
      }
      return NextResponse.json({ library: versionedLib }, {
        headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
      });
    }

    return NextResponse.json({ library }, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load supplier library' }, { status: 500 });
  }
}
