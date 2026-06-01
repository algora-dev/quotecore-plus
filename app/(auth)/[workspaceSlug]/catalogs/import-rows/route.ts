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
 * SECURITY (Gerald H-01, 2026-06-01):
 *   Storage accounting and growth caps are SERVER-AUTHORITATIVE here. The
 *   browser-supplied `dataBytes` passed to createCatalogMeta() is only a
 *   provisional pre-flight estimate; on the final batch we recompute the
 *   real JSONB byte size from the rows actually stored, reconcile
 *   catalogs.data_bytes to that value, and adjust storage_used_bytes by the
 *   true delta. We also enforce hard per-catalog caps on total rows and
 *   total JSONB bytes so a malicious client cannot blow DB growth/quota by
 *   POSTing batches directly with an understated dataBytes.
 *
 * NOTE: catalog_rows is not in database.types.ts yet (types regen pending
 * migration apply). Using (admin as any) throughout — documented pattern.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { assertCanUseStorage } from '@/app/lib/billing/entitlements';
import { isBillingError } from '@/app/lib/billing/errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const MAX_ROWS_PER_BATCH = 5_000;
const SUB_BATCH = 1_000;

// Hard per-catalog growth caps (server-authoritative, independent of any
// browser-supplied estimate). A real supplier price-list is well within
// these; they exist to bound DB growth + cost on abuse.
const MAX_ROWS_PER_CATALOG = 250_000;
const MAX_BYTES_PER_CATALOG = 50 * 1024 * 1024; // 50 MB of JSONB

interface ImportRowsBody {
  catalogId: string;
  rows: Array<{ rowIndex: number; raw: Record<string, string> }>;
  isFirstBatch: boolean;
  isLastBatch: boolean;
}

/** Server-side byte size of a row's raw JSONB payload. */
function rowBytes(raw: Record<string, string>): number {
  return Buffer.byteLength(JSON.stringify(raw ?? {}), 'utf8');
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
      .select('id, company_id, row_count, data_bytes, status')
      .eq('id', catalogId)
      .eq('company_id', profile.company_id)
      .single();

    if (catErr || !catalog) {
      return NextResponse.json({ ok: false, code: 'not_found', message: 'Catalog not found.' }, { status: 404 });
    }

    const cat = catalog as {
      id: string;
      company_id: string;
      row_count: number;
      data_bytes: number;
      status: string;
    };

    if (!['importing', 'error'].includes(cat.status)) {
      return NextResponse.json(
        { ok: false, code: 'invalid_status', message: `Catalog not in importing state (status: ${cat.status}).` },
        { status: 409 },
      );
    }

    // First batch: clear any existing rows (replace-file flow). If this
    // catalog was previously imported to completion, its bytes were already
    // charged to storage_used_bytes on that prior final batch — reverse that
    // charge now and reset data_bytes to 0 so the new import re-accounts
    // from scratch (prevents double-charge on replace-file).
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

      // Only a catalog that reached 'ready' had its bytes charged to
      // storage. An abandoned 'importing'/'error' catalog accrued a running
      // data_bytes total that was never charged, so must NOT be reversed.
      const previouslyCharged = cat.status === 'ready' ? (cat.data_bytes ?? 0) : 0;
      if (previouslyCharged > 0) {
        await (createAdminClient() as AnyClient).rpc('adjust_company_storage', {
          p_company_id: profile.company_id,
          p_delta_bytes: -previouslyCharged,
        });
      }
      await admin
        .from('catalogs')
        .update({ data_bytes: 0, row_count: 0, updated_at: new Date().toISOString() })
        .eq('id', catalogId)
        .eq('company_id', profile.company_id);
      // Reflect the reset locally for the rest of this request.
      cat.data_bytes = 0;
      cat.row_count = 0;
    }

    // ---- Server-authoritative growth caps (H-01) --------------------
    // Determine how many rows already exist for this catalog (0 on first
    // batch since we just cleared) and reject if this batch would push the
    // catalog over the hard row cap.
    const existingRows = isFirstBatch ? 0 : cat.row_count;
    if (existingRows + rows.length > MAX_ROWS_PER_CATALOG) {
      return NextResponse.json(
        {
          ok: false,
          code: 'catalog_too_large',
          message: `Catalog exceeds the ${MAX_ROWS_PER_CATALOG.toLocaleString()}-row limit.`,
        },
        { status: 400 },
      );
    }

    // Compute this batch's authoritative byte size + reject if the running
    // total would exceed the per-catalog byte cap.
    const batchBytes = rows.reduce((sum, r) => sum + rowBytes(r.raw), 0);
    const priorBytes = isFirstBatch ? 0 : cat.data_bytes ?? 0;
    if (priorBytes + batchBytes > MAX_BYTES_PER_CATALOG) {
      return NextResponse.json(
        {
          ok: false,
          code: 'catalog_too_large',
          message: `Catalog exceeds the ${Math.round(MAX_BYTES_PER_CATALOG / 1024 / 1024)}MB data limit.`,
        },
        { status: 400 },
      );
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

    // Running totals (authoritative).
    const newRowCount = existingRows + rows.length;
    const newDataBytes = priorBytes + batchBytes;

    if (isLastBatch) {
      // Final reconciliation. Storage is NOT charged during createCatalogMeta
      // or intermediate batches (data_bytes tracks the running total only).
      // We charge the full authoritative total to storage_used_bytes exactly
      // once here, so accounting matches real stored size and delete reverses
      // the correct amount.
      const delta = newDataBytes; // nothing charged to storage yet for this catalog

      // Re-assert quota against the AUTHORITATIVE total size. If the real
      // data exceeds quota, reject and leave the catalog in 'error' so it is
      // not usable; do not flip to ready.
      try {
        if (delta > 0) {
          await assertCanUseStorage(profile.company_id, delta);
        }
      } catch (err) {
        await admin
          .from('catalogs')
          .update({ row_count: newRowCount, data_bytes: newDataBytes, status: 'error', updated_at: new Date().toISOString() })
          .eq('id', catalogId)
          .eq('company_id', profile.company_id);
        const code = isBillingError(err) ? err.code : 'storage_quota_exceeded';
        const message = err instanceof Error ? err.message : 'Storage quota exceeded.';
        return NextResponse.json({ ok: false, code, message }, { status: 409 });
      }

      const { error: updateErr } = await admin
        .from('catalogs')
        .update({ row_count: newRowCount, data_bytes: newDataBytes, status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', catalogId)
        .eq('company_id', profile.company_id);

      if (updateErr) {
        console.error('[import-rows] final catalog update error:', updateErr);
        return NextResponse.json({ ok: false, code: 'finalize_failed', message: updateErr.message }, { status: 500 });
      }

      // Reconcile storage_used_bytes by the authoritative delta.
      if (delta !== 0) {
        await (createAdminClient() as AnyClient).rpc('adjust_company_storage', {
          p_company_id: profile.company_id,
          p_delta_bytes: delta,
        });
      }
    } else {
      // Intermediate batch: persist running totals so the next batch + a
      // future delete reverse the correct amount even mid-import.
      const { error: updateErr } = await admin
        .from('catalogs')
        .update({ row_count: newRowCount, data_bytes: newDataBytes, status: 'importing', updated_at: new Date().toISOString() })
        .eq('id', catalogId)
        .eq('company_id', profile.company_id);

      if (updateErr) {
        console.error('[import-rows] catalog update error:', updateErr);
        // Non-fatal — rows inserted; totals will reconcile on last batch.
      }
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
