import { redirect } from 'next/navigation';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { verifyQuoteOwnership } from '@/app/lib/auth/ownership';
import { listMeasurementImportsForQuote } from '@/app/lib/measurements-import/storage.server';
import { loadImportReview } from './actions';
import { MeasurementImportClient } from './MeasurementImportClient';
import '@/app/(auth)/[workspaceSlug]/pricing/assistant/assistant.css';
import '@/app/components/ui/v2/qc-tooltip.css';
import './measurement-import.css';

export default async function MeasurementImportPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
  searchParams: Promise<{ import?: string }>;
}) {
  const { workspaceSlug, id: quoteId } = await params;
  if (process.env.NEXT_PUBLIC_MEASUREMENT_IMPORT_ENABLED !== 'true') {
    redirect(`/${workspaceSlug}/quotes/${quoteId}`);
  }
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);
  const { data: quote } = await supabase.from('quotes').select('customer_name, job_name').eq('id', quoteId).maybeSingle() as unknown as { data: { customer_name: string | null; job_name: string | null } | null };
  const { data: collections } = await supabase.from('component_collections')
    .select('id,name,is_bootstrap').eq('company_id', profile.company_id)
    .order('is_bootstrap', { ascending: false }).order('name');
  // Component counts per library so the capture page can default to the first
  // library that actually has components and mark empty ones (owner 2026-11-16).
  const { data: libCountRows } = await supabase.from('component_library')
    .select('collection_id').eq('company_id', profile.company_id);
  const libCounts = new Map<string, number>();
  for (const row of (libCountRows ?? []) as Array<{ collection_id: string | null }>) {
    if (row.collection_id) libCounts.set(row.collection_id, (libCounts.get(row.collection_id) ?? 0) + 1);
  }
  let activeImports: Awaited<ReturnType<typeof listMeasurementImportsForQuote>> = [];
  try { activeImports = await listMeasurementImportsForQuote(quoteId); } catch { /* fresh quote */ }
  const wanted = (await searchParams).import;
  let current: Awaited<ReturnType<typeof loadImportReview>> | null = null;
  if (wanted) { try { current = await loadImportReview(wanted); } catch { current = null; } }

  return (
    <div data-qc-ui="v2" className="pa-page mi-page">
      <MeasurementImportClient
        workspaceSlug={workspaceSlug}
        quoteId={quoteId}
        quoteLabel={quote?.customer_name || quote?.job_name || 'this quote'}
        collections={(collections ?? []).map(c => ({ id: c.id, name: c.name, isBootstrap: c.is_bootstrap, count: libCounts.get(c.id) ?? 0 }))}
        initialCurrent={current}
        activeImports={activeImports.map(s => ({ id: s.id, sourceName: s.source_name, remaining: s.remaining }))}
      />
    </div>
  );
}
