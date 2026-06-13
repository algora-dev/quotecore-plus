/**
 * POST /[workspaceSlug]/catalogs/import-rows
 *
 * Accepts batches of parsed CSV rows and inserts them into catalog_rows.
 * The client chunks requests at ~2,000 rows each and calls this for each chunk.
 * On the last chunk (isLastBatch=true) the catalog status flips to 'ready'.
 *
 * Body: { catalogId, rows: [{rowIndex, raw}], isFirstBatch, isLastBatch }
 * Returns: { ok, insertedCount, totalCount, overQuota } or { ok:false, code, message }
 *
 * SECURITY (Gerald H-01-R / H-02-R / M-01-R, 2026-06-01):
 *   ALL accounting + insertion happens inside a single SECURITY DEFINER RPC,
 *   `import_catalog_rows_atomic`, serialised per catalog via an advisory
 *   lock. The RPC charges storage by the real byte delta as each batch
 *   lands (not deferred to finalisation), enforces the 10MB/250k hard
 *   ceiling, and is race-safe. This route is now a thin auth + delegate
 *   wrapper; it computes nothing about bytes itself.
 *
 *   Per Shaun's product call (option 3): an import is allowed to COMPLETE
 *   even if it pushes the company over their PLAN storage quota (max
 *   overspill = the 10MB ceiling). over_quota=true in that case; the company
 *   is "red" and the app-layer assertCanUseStorage() blocks all FUTURE
 *   uploads until they free space or upgrade.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const MAX_ROWS_PER_BATCH = 5_000;

interface ImportRowsBody {
  catalogId: string;
  rows: Array<{ rowIndex: number; raw: Record<string, string> }>;
  isFirstBatch: boolean;
  isLastBatch: boolean;
}

/** Map RPC SQLSTATEs to client-facing error codes. */
function mapRpcError(code: string | undefined, message: string): { httpStatus: number; code: string; message: string } {
  switch (code) {
    case 'P0015':
      return { httpStatus: 404, code: 'not_found', message: 'Catalog not found.' };
    case 'P0016':
      return { httpStatus: 409, code: 'invalid_status', message: 'Catalog is not in an importing state.' };
    case 'P0017':
      return {
        httpStatus: 400,
        code: 'catalog_too_large',
        message: 'This catalog exceeds the 10MB / 250,000-row limit. Split the file or trim it and try again.',
      };
    default:
      return { httpStatus: 500, code: 'insert_failed', message };
  }
}

export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ workspaceSlug: string }> },
): Promise<NextResponse> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AnyClient;

    let body: ImportRowsBody;
    try {
      body = (await request.json()) as ImportRowsBody;
    } catch {
      return NextResponse.json({ ok: false, code: 'bad_request', message: 'Invalid JSON body.' }, { status: 400 });
    }

    const { catalogId, rows, isFirstBatch, isLastBatch } = body;

    if (!catalogId || !Array.isArray(rows)) {
      return NextResponse.json({ ok: false, code: 'bad_request', message: 'catalogId and rows required.' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS_PER_BATCH) {
      return NextResponse.json(
        { ok: false, code: 'batch_too_large', message: `Batch exceeds ${MAX_ROWS_PER_BATCH} rows.` },
        { status: 400 },
      );
    }

    // Shape rows for the RPC: [{ row_index, raw }]. Validate row_index is an int.
    const payload = rows.map((r) => ({
      row_index: Number.isInteger(r.rowIndex) ? r.rowIndex : 0,
      raw: r.raw ?? {},
    }));

    const { data, error } = await admin.rpc('import_catalog_rows_atomic', {
      p_company_id: profile.company_id,
      p_catalog_id: catalogId,
      p_rows: payload,
      p_is_first: !!isFirstBatch,
      p_is_last: !!isLastBatch,
    });

    if (error) {
      const mapped = mapRpcError((error as { code?: string }).code, error.message ?? 'Import failed.');
      if (mapped.httpStatus >= 500) console.error('[import-rows] rpc error:', error);
      return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: mapped.httpStatus });
    }

    // RPC returns a single-row table: { row_count, data_bytes, over_quota }.
    const result = Array.isArray(data) ? data[0] : data;
    const totalCount = (result?.row_count as number | undefined) ?? 0;
    const overQuota = (result?.over_quota as boolean | undefined) ?? false;

    return NextResponse.json({ ok: true, insertedCount: rows.length, totalCount, overQuota });
  } catch (err) {
    console.error('[import-rows] unexpected:', err);
    return NextResponse.json(
      { ok: false, code: 'server_error', message: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
