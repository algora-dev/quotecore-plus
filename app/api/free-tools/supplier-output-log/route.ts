import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { jsPDF } from 'jspdf';

export const runtime = 'nodejs';

/**
 * POST /api/free-tools/supplier-output-log
 *
 * Lightweight proof-of-use tracking for the supplier pricing tools.
 * Whenever a user reaches the final output in /supplier-pricing-tool/<slug>,
 * the client fire-and-forgets the output snapshot here. We store:
 *   - one row per output: tool slug, timestamp, totals, full snapshot JSON
 *   - a simple server-generated PDF of the output in a private bucket
 *
 * This is the ONLY server-side visibility into tool usage (everything else
 * lives in the visitor's browser). Fire-and-forget: always 204 on success,
 * 204 even on internal failure (never surfaces errors to the demo user).
 *
 * Payload caps: max 80 lines, 20 customs, 40KB JSON. Slug regex-validated.
 */

type LineIn = {
  groupLabel?: string;
  entryLabel?: string | null;
  name?: string;
  code?: string;
  basisUnit?: string;
  purchaseQty?: number;
  unitPrice?: number;
  lineTotal?: number;
};
type CustomIn = { name?: string; qty?: number; total?: number };

let serviceClient: ReturnType<typeof createServiceClient<Database>> | null = null;
function getClient() {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  serviceClient = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

const SLUG_RE = /^[a-z0-9-]{2,40}$/;
const money = (n: number, cur: string) =>
  `${cur === 'NZD' ? '$' : cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : ''}${n.toFixed(2)}`;

function buildPdf(args: {
  slug: string; supplierName: string; trade: string | null; currency: string;
  lines: LineIn[]; customs: CustomIn[]; material: number; labour: number; created: Date;
}): Uint8Array {
  const { slug, supplierName, trade, currency, lines, customs, material, labour, created } = args;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 50;

  doc.setFontSize(16);
  doc.text(`${supplierName} - tool output record`, 40, y);
  y += 20;
  doc.setFontSize(9);
  doc.text(
    `Tool: ${slug}${trade ? ` (${trade})` : ''}   Created: ${created.toISOString()}`,
    40, y,
  );
  y += 24;

  doc.setFontSize(11);
  doc.text('Materials', 40, y); y += 16;
  doc.setFontSize(9);
  for (const l of lines) {
    if (y > 780) { doc.addPage(); y = 50; }
    const label = l.entryLabel ? `${l.name} (${l.entryLabel})` : l.name ?? 'item';
    doc.text(String(label).slice(0, 60), 40, y);
    const qty = `${(l.purchaseQty ?? 0).toFixed(2)} ${l.basisUnit ?? ''}`;
    doc.text(qty, W - 220, y, { align: 'right' });
    doc.text(money(l.lineTotal ?? 0, currency), W - 40, y, { align: 'right' });
    y += 14;
  }
  if (customs.length > 0) {
    y += 8; doc.setFontSize(11); doc.text('Custom components', 40, y); y += 16; doc.setFontSize(9);
    for (const c of customs) {
      if (y > 780) { doc.addPage(); y = 50; }
      doc.text(String(c.name ?? 'custom').slice(0, 60), 40, y);
      doc.text(money(c.total ?? 0, currency), W - 40, y, { align: 'right' });
      y += 14;
    }
  }
  y += 10;
  if (y > 760) { doc.addPage(); y = 50; }
  doc.setFontSize(10);
  doc.text(`Materials total: ${money(material, currency)}`, 40, y); y += 14;
  doc.text(`Labour total: ${money(labour, currency)}`, 40, y); y += 14;
  doc.text(`Grand total: ${money(material + labour, currency)}`, 40, y);
  return doc.output('arraybuffer') as unknown as Uint8Array;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    if (!(await checkRateLimit(`spt-out:${ip}`, 30, 60 * 60 * 1000))) {
      return new NextResponse(null, { status: 204 });
    }

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== 'object') return new NextResponse(null, { status: 204 });
    const body = raw as Record<string, unknown>;

    const slug = typeof body.toolSlug === 'string' ? body.toolSlug.trim() : '';
    if (!SLUG_RE.test(slug)) return new NextResponse(null, { status: 204 });

    const currency = typeof body.currency === 'string' ? body.currency.slice(0, 8) : null;
    const trade = typeof body.trade === 'string' ? body.trade.slice(0, 40) : null;
    const supplierName = typeof body.supplierName === 'string' ? body.supplierName.slice(0, 60) : slug;
    const material = Number(body.material) || 0;
    const labour = Number(body.labour) || 0;
    const lines = Array.isArray(body.lines)
      ? (body.lines as LineIn[]).slice(0, 80).map(l => ({
          groupLabel: typeof l.groupLabel === 'string' ? l.groupLabel.slice(0, 60) : undefined,
          entryLabel: typeof l.entryLabel === 'string' ? l.entryLabel.slice(0, 60) : null,
          name: typeof l.name === 'string' ? l.name.slice(0, 80) : undefined,
          code: typeof l.code === 'string' ? l.code.slice(0, 40) : undefined,
          basisUnit: typeof l.basisUnit === 'string' ? l.basisUnit.slice(0, 12) : undefined,
          purchaseQty: Number(l.purchaseQty) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          lineTotal: Number(l.lineTotal) || 0,
        }))
      : [];
    const customs = Array.isArray(body.customs)
      ? (body.customs as CustomIn[]).slice(0, 20).map(c => ({
          name: typeof c.name === 'string' ? c.name.slice(0, 80) : undefined,
          qty: Number(c.qty) || 0,
          total: Number(c.total) || 0,
        }))
      : [];
    if (lines.length === 0 && customs.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const client = getClient();
    if (!client) return new NextResponse(null, { status: 204 });

    const payload = { trade, currency, material, labour, lines, customs };

    // Generate the PDF first - upload path is derived from the row after insert.
    const pdf = buildPdf({ slug, supplierName, trade, currency: currency ?? '', lines, customs, material, labour, created: new Date() });

    const { data: row, error: insertErr } = await client
      .from('supplier_tool_outputs')
      .insert({
        tool_slug: slug,
        trade,
        currency,
        total_material: material,
        total_labour: labour,
        item_count: lines.length + customs.length,
        payload,
      })
      .select('id')
      .single();
    if (insertErr || !row) return new NextResponse(null, { status: 204 });

    const path = `${slug}/${row.id}.pdf`;
    const { error: upErr } = await client.storage
      .from('supplier-tool-outputs')
      .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (!upErr) {
      await client.from('supplier_tool_outputs').update({ pdf_path: path }).eq('id', row.id);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
