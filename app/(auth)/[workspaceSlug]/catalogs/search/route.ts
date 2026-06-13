/**
 * POST /[workspaceSlug]/catalogs/search
 *
 * Debounced catalog search via pg_trgm ILIKE on catalog_rows.search_text.
 * Scoped to the authenticated user's company.
 *
 * Body:
 *   { query: string; catalogId?: string | null; limit?: number }
 *
 * Returns:
 *   { ok: true; results: SearchHit[] }
 *   { ok: false; code: string; message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
// search_catalog_rows not in generated types yet - pending migration apply.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export interface SearchHit {
  id: string;
  catalogId: string;
  catalogName: string;
  rowIndex: number;
  rawRow: Record<string, string>;
}

interface SearchBody {
  query: string;
  catalogId?: string | null;
  limit?: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MIN_QUERY_LENGTH = 1;

export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ workspaceSlug: string }> },
): Promise<NextResponse> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AnyClient;

    let body: SearchBody;
    try {
      body = (await request.json()) as SearchBody;
    } catch {
      return NextResponse.json({ ok: false, code: 'bad_request', message: 'Invalid JSON body.' }, { status: 400 });
    }

    const query = (body.query ?? '').trim();
    if (query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ ok: true, results: [] });
    }

    const limit = Math.min(body.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const catalogId = body.catalogId ?? null;

    const { data, error } = await (admin as AnyClient).rpc('search_catalog_rows', {
      p_company_id: profile.company_id,
      p_catalog_id: catalogId,
      p_query: query,
      p_limit: limit,
    });

    if (error) {
      console.error('[catalog-search] RPC error:', error);
      return NextResponse.json({ ok: false, code: 'search_failed', message: error.message }, { status: 500 });
    }

    const results: SearchHit[] = ((data as unknown[]) ?? []).map((row) => {
      const r = row as {
        id: string;
        catalog_id: string;
        catalog_name: string;
        row_index: number;
        raw_row: Record<string, string>;
        search_text: string;
      };
      return {
        id: r.id,
        catalogId: r.catalog_id,
        catalogName: r.catalog_name,
        rowIndex: r.row_index,
        rawRow: r.raw_row,
      };
    });

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('[catalog-search] unexpected error:', err);
    return NextResponse.json(
      { ok: false, code: 'server_error', message: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
