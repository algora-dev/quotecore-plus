/**
 * POST /[workspaceSlug]/catalogs/import-rows
 *
 * Accepts batches of parsed CSV rows and inserts them into catalog_rows.
 * The client chunks requests at ~2,000 rows each and calls this for each chunk.
 * On the last chunk (isLastBatch=true) the catalog status flips to 'ready'.
 *
 * Body: { catalogId, rows: [{rowIndex, raw}], isFirstBatch, isLastBatch }
 * Returns: { ok, insertedCount, totalCount } or { ok: false, code, message }
 *
 * NOTE: catalog_rows is not in database.types.ts yet (types regen pending
 * migration apply). Using (admin as any) throughout — documented pattern.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const MAX_ROWS_PER_BATCH = 5_000;
const SUB_BATCH = 1_000;

interface ImportRowsBody {
  catalogId: string;
  rows: Array<{ rowIndex: number; raw: Record<string, string> }>;
  isFirstBatch: boolean;
  isLastBatch: boolean;
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

    // Verify catalog ownership + status
    const { data: catalog, error: catErr } = await admin
      .from('catalogs')
      .select('id, company_id, row_count, status')
      .eq('id', catalogId)
      .eq('company_id', profile.company_id)
      .single();

    if (catErr || !catalog) {
      return NextResponse.json({ ok: false, code: 'not_found', message: 'Catalog not found.' }, { status: 404 });
    }

    const cat = catalog as { id: string; company_id: string; row_count: number; status: string };

    if (!['importing', 'error'].includes(cat.status)) {
      return NextResponse.json(
        { ok: false, code: 'invalid_status', message: `Catalog not in importing state (status: ${cat.status}).` },
        { status: 409 },
      );
    }

    // First batch: clear any existing rows (replace-file flow)
    if (isFirstBatch) {
      const { error: delErr } = await admin
        .from('catalog_rows')
        .delete()
        .eq('catalog_id', catalogId)
        .eq('company_id', profile.company_id);

      if (delErr) {
        console.error('[import-rows] failed to clear existing rows:', delErr);
        return NextResponse.json({ ok: false, code: 'clear_failed', message: delErr.message }, { status: 500 });
      }
    }

    // Build rows with search_text server-side (never trust client)
    const rowsToInsert = rows.map((r) => ({
      catalog_id: catalogId,
      company_id: profile.company_id,
      row_index: r.rowIndex,
      raw_row: r.raw,
      search_text: Object.values(r.raw)
        .map((v) => String(v ?? ''))
        .join(' ')
        .toLowerCase(),
    }));

    // Insert in sub-batches
    for (let i = 0; i < rowsToInsert.length; i += SUB_BATCH) {
      const chunk = rowsToInsert.slice(i, i + SUB_BATCH);
      const { error: insErr } = await admin.from('catalog_rows').insert(chunk);
      if (insErr) {
        console.error('[import-rows] insert error:', insErr);
        return NextResponse.json({ ok: false, code: 'insert_failed', message: insErr.message }, { status: 500 });
      }
    }

    // Update row_count + flip status on last batch
    const newRowCount = isFirstBatch ? rows.length : cat.row_count + rows.length;
    const nextStatus = isLastBatch ? 'ready' : 'importing';

    const { error: updateErr } = await admin
      .from('catalogs')
      .update({ row_count: newRowCount, status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', catalogId)
      .eq('company_id', profile.company_id);

    if (updateErr) {
      console.error('[import-rows] catalog update error:', updateErr);
      // Non-fatal — rows inserted
    }

    return NextResponse.json({ ok: true, insertedCount: rows.length, totalCount: newRowCount });
  } catch (err) {
    console.error('[import-rows] unexpected:', err);
    return NextResponse.json(
      { ok: false, code: 'server_error', message: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
