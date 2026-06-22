import { redirect } from 'next/navigation';
import Link from 'next/link';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadAllEntriesForQuote } from '../../actions';
import {  } from '../../../components/actions';
import { computeQuoteTotals } from '@/app/lib/pricing/engine';
import {  } from '@/app/lib/types';
import { formatArea, getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import {
  convertLinear,
  convertArea,
  convertAreaFt2,
} from '@/app/lib/measurements/conversions';
import { normalizeMeasurementSystem } from '@/app/lib/types';
// ConvertSystemButton removed: a quote's measurement system is locked at
// creation time and cannot be changed afterwards. The user picks it on the
// new-quote form via QuoteDetailsForm.
import { CurrencySelector } from './CurrencySelector';
import { DownloadSummaryPDFButton } from './DownloadSummaryPDFButton';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { SendQuoteButton } from './SendQuoteButton';
import { WithdrawQuoteButton } from './WithdrawQuoteButton';
import { ReopenQuoteButton } from './ReopenQuoteButton';
import { SummaryTabs } from './SummaryTabs';
import { SummaryFilesPanel } from './SummaryFilesPanel';
import { ActivityCard } from './ActivityCard';
import { QuoteExpiryEditor } from './QuoteExpiryEditor';
import { QuoteNotesPanel, type QuoteNote } from './QuoteNotesPanel';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { loadQuoteTaxes } from '@/app/lib/taxes/actions';
import { computeTaxLines } from '@/app/lib/taxes/types';
import { getSignedUrls } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';

export default async function QuoteSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
  searchParams: Promise<{ from?: string; view?: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const { from, view } = await searchParams;
  // When opened from the Message Center, "Back" returns to the inbox.
  const backHref = from === 'inbox' ? `/${workspaceSlug}/inbox` : `/${workspaceSlug}/quotes`;
  const backLabel = from === 'inbox' ? 'Back to Message Center' : 'Back';
  const [quote, roofAreas, components, entries, quoteTaxes] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadQuoteComponents(id),
    loadAllEntriesForQuote(id),
    loadQuoteTaxes(id),
  ]);

  // Activity card is a paid-tier feature. Trial keeps it (to drive upgrade
  // pitch); Starter hides it; Growth+ has it. The flag is computed off the
  // effective plan, so dunning-collapsed accounts (grace -> starter) hide
  // the card automatically.
  const entitlements = await loadCompanyEntitlements(quote.company_id);
  const activityCardEnabled = entitlements.features.activity_card;

  const supabase = await createSupabaseServerClient();

  // One-time "test it on yourself first" send tip: has THIS user seen it?
  const _profile = await getCurrentProfile();
  const { data: _stt } = await supabase
    .from('users')
    .select('send_test_tip_seen_at')
    .eq('id', _profile.id)
    .maybeSingle();
  const sendTestTipSeen = !!(_stt as { send_test_tip_seen_at?: string | null } | null)?.send_test_tip_seen_at;

  // Load notes for this quote (newest first), joining author name for M-01
  const { data: notesData } = await supabase
    .from('quote_notes')
    .select('id, title, body, created_at, updated_at, author:users!created_by_user_id(full_name)')
    .eq('quote_id', id)
    .order('created_at', { ascending: false });
  const quoteNotes: QuoteNote[] = (notesData ?? []) as unknown as QuoteNote[];
  const currentUserFullName = _profile.full_name ?? null;

  // Load ALL customer quote lines (for custom lines + hasCustomerQuote flag)
  const { data: allCustomerLines } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', id)
    .order('sort_order', { ascending: true });

  // Separate custom lines (non-component lines added manually by the user)
  const customLines = (allCustomerLines || []).filter(
    line => line.line_type === 'custom' && line.is_visible && line.include_in_total
  );

  // Detect if customer quote has been saved
  const hasCustomerQuote = (allCustomerLines || []).length > 0;

  // Load labor sheet lines
  const { data: laborSheetLines } = await supabase
    .from('labor_sheet_lines')
    .select('id, custom_text, custom_amount, show_price, is_visible, include_in_total')
    .eq('quote_id', id)
    .order('sort_order');

  const hasLaborSheet = (laborSheetLines || []).length > 0;

  // Load email templates for Send Quote modal. attachment_id (Phase 4 baked
  // default) is included so the send picker can pre-check the template's file.
  const { data: emailTemplates } = await supabase
    .from('email_templates')
    .select('id, name, subject, body, is_default, attachment_id')
    .eq('company_id', quote.company_id)
    .order('created_at', { ascending: false });

  // Attachment library for the send picker (Pro+ gated). IDS + name + size
  // only - never storage_path on client props (Gerald H-03 #5). When the
  // company isn't entitled we pass an empty list and lock the source.
  const attachmentsEnabled = entitlements.features.attachment_library;
  let libraryPickerFiles: Array<{ id: string; name: string; fileSize: number }> = [];
  if (attachmentsEnabled) {
    const { data: libRows } = await supabase
      .from('company_attachments')
      .select('id, name, file_size')
      .eq('company_id', quote.company_id)
      .is('archived_at', null)
      .order('name', { ascending: true });
    libraryPickerFiles = (libRows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      fileSize: r.file_size,
    }));
  }

  // NOTE: The Summary is the pricing-engine view - it always computes from raw
  // component base costs + global margins. The Customer Quote Editor is the
  // separate presentation layer where users can customise per-line amounts and
  // margins. We intentionally do NOT apply customer_quote_line custom_amounts
  // here; doing so caused a double-margin bug where margins were applied twice
  // (once baked into custom_amount at save time, again by computeQuoteTotals).

  // Load company default currency
  const { data: company } = await supabase
    .from('companies')
    .select('default_currency, name')
    .eq('id', quote.company_id)
    .single();
  const companyDefaultCurrency = company?.default_currency || 'NZD';
  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);

  // Load customer-submitted revision requests (from the public acceptance URL)
  // so we can surface them on the summary as a pending action.
  const { data: revisionRequestsData } = await supabase
    .from('quote_revision_requests')
    .select('id, notes, customer_name, customer_email, source_state, created_at, resolved_at')
    .eq('quote_id', id)
    .order('created_at', { ascending: false });
  const revisionRequests = (revisionRequestsData ?? []) as Array<{
    id: string;
    notes: string;
    customer_name: string | null;
    customer_email: string | null;
    source_state: 'active' | 'expired' | 'responded' | 'withdrawn';
    created_at: string;
    resolved_at: string | null;
  }>;

  // Load all files (plan + supporting)
  const { data: filesData } = await supabase
    .from('quote_files')
    .select('id, file_type, file_name, file_size, storage_path, uploaded_at')
    .eq('quote_id', id)
    .order('uploaded_at', { ascending: false });

  const _planFile = filesData?.find(f => f.file_type === 'plan');
  const _supportingFiles = filesData?.filter(f => f.file_type === 'supporting') || [];

  // P1-1b: new saves create quote_files records for each canvas snapshot so all
  // takeoff images appear here. For older quotes that pre-date this change,
  // fall back to quotes.takeoff_canvas_path (added manually below).
  const hasCanvasFileRecords = (filesData || []).some(f => f.file_type === 'takeoff_canvas');
  const hasLinesFileRecords  = (filesData || []).some(f => f.file_type === 'takeoff_lines');

  const canvasPath = quote.takeoff_canvas_path ?? null;
  const linesPath  = quote.takeoff_lines_path  ?? null;

  const allPathsToSign = [
    ...(filesData || []).map((f) => f.storage_path),
    ...(!hasCanvasFileRecords && canvasPath ? [canvasPath] : []),
    ...(!hasLinesFileRecords  && linesPath  ? [linesPath]  : []),
  ];
  const signed = allPathsToSign.length > 0
    ? await getSignedUrls(BUCKETS.QUOTE_DOCUMENTS, allPathsToSign)
    : [];
  const signedByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const allFiles = (filesData || []).map((file) => ({
    ...file,
    url: signedByPath.get(file.storage_path) ?? '',
  }));

  // Backward-compat: add canvas images from quote columns only when no
  // quote_files records exist yet (old quotes pre-dating P1-1b).
  if (!hasCanvasFileRecords) {
    const canvasUrl = canvasPath
      ? signedByPath.get(canvasPath) ?? ''
      : (quote.takeoff_canvas_url ?? '');
    if (canvasUrl) {
      allFiles.push({
        id: 'canvas-image',
        file_type: 'takeoff_canvas' as any,
        file_name: 'Digital Takeoff Canvas',
        file_size: 0,
        storage_path: canvasPath ?? '',
        uploaded_at: quote.updated_at,
        url: canvasUrl,
      });
    }
  }
  if (!hasLinesFileRecords) {
    const linesUrl = linesPath
      ? signedByPath.get(linesPath) ?? ''
      : (quote.takeoff_lines_url ?? '');
    if (linesUrl) {
      allFiles.push({
        id: 'canvas-lines',
        file_type: 'takeoff_lines' as any,
        file_name: 'Takeoff Lines Only (Print Ready)',
        file_size: 0,
        storage_path: linesPath ?? '',
        uploaded_at: quote.updated_at,
        url: linesUrl,
      });
    }
  }



  const _totalRoofSqm = roofAreas.reduce((sum, a) => sum + (a.computed_sqm ?? 0), 0);

  const mainComps = components.filter(c => c.quote_roof_area_id);
  const extraComps = components.filter(c => !c.quote_roof_area_id);

  // Phase 5: trade-aware heading for the "no area" bucket. A generic-trade
  // quote with zero areas means every component lands in `extraComps` by
  // design (no-area flow). Render it under "Quote items" instead of "Extras"
  // so the page reads correctly for the no-area UX. Roofing quotes (or any
  // quote that DOES have areas) keep the existing "Extras" heading.
  // `quote.trade` is from Phase 2 (column landed in dark-schema migration);
  // database.types.ts hasn't been regenerated yet, so cast at the boundary.
  const quoteTrade = (quote as { trade?: 'roofing' | 'generic' | null }).trade ?? 'roofing';
  const isGenericNoArea = quoteTrade === 'generic' && roofAreas.length === 0;
  const extrasHeading = isGenericNoArea ? 'Quote items' : 'Extras';

  const engineComps = components.map(c => ({
    id: c.id, name: c.name, componentType: c.component_type as 'main' | 'extra',
    measurementType: c.measurement_type as 'area' | 'lineal' | 'quantity' | 'fixed', inputMode: c.input_mode as 'final' | 'calculated',
    finalValue: c.final_value ?? undefined, calcRawValue: c.calc_raw_value ?? undefined,
    calcPitchDegrees: c.calc_pitch_degrees ?? undefined, calcPitchFactor: c.calc_pitch_factor ?? undefined,
    wasteType: c.waste_type as 'percent' | 'fixed' | 'none', wastePercent: c.waste_percent, wasteFixed: c.waste_fixed,
    finalQuantity: c.final_quantity ?? undefined, materialRate: c.material_rate, labourRate: c.labour_rate,
    materialCost: c.material_cost, labourCost: c.labour_cost, isRateOverridden: c.is_rate_overridden, isQuantityOverridden: c.is_quantity_overridden,
    isWasteOverridden: c.is_waste_overridden, isPitchOverridden: c.is_pitch_overridden, isCustomerVisible: c.is_customer_visible, pricingUnit: c.pricing_unit ?? undefined,
  }));
  const totals = computeQuoteTotals(engineComps, { materialMarginPct: quote.material_margin_percent ?? 0, labourMarginPct: quote.labor_margin_percent ?? 0, taxRate: quote.tax_rate });

  // Calculate custom lines total
  const customLinesTotal = (customLines || []).reduce((sum, line) => sum + (line.custom_amount || 0), 0);

  // Adjust totals to include custom lines
  const adjustedSubtotal = totals.subtotalWithMargins + customLinesTotal;
  const { lines: summaryTaxLines, total: adjustedTax } = computeTaxLines(quoteTaxes, adjustedSubtotal, 'quote');
  const adjustedGrandTotal = adjustedSubtotal + adjustedTax;

  // â”€â”€ Original Summary Snapshot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Load or lazily create the "original" snapshot. This is captured the FIRST
  // time the user arrives on the Summary page (right after saving from Review
  // or Blank Quote Creator). It is never overwritten after creation.
  const { data: snapshotRow } = await supabase
    .from('quotes')
    .select('original_summary_snapshot')
    .eq('id', id)
    .single();
  const existingSnapshot = (snapshotRow as any)?.original_summary_snapshot ?? null;

  if (!existingSnapshot) {
    // Build and persist the snapshot on first visit.
    const snapshotData = {
      capturedAt: new Date().toISOString(),
      materialMarginPercent: Number(quote.material_margin_percent ?? 0),
      labourMarginPercent: Number(quote.labor_margin_percent ?? 0),
      components: engineComps.map(c => ({
        id: c.id,
        name: c.name,
        materialCost: Number(c.materialCost ?? 0),
        labourCost: Number(c.labourCost ?? 0),
        total: Number((c.materialCost ?? 0) + (c.labourCost ?? 0)),
      })),
      totalMaterials: totals.totalMaterials,
      totalLabour: totals.totalLabour,
      materialMargin: totals.materialMargin,
      labourMargin: totals.labourMargin,
      subtotalWithMargins: totals.subtotalWithMargins,
      customLinesTotal,
      adjustedSubtotal,
      adjustedTax,
      adjustedGrandTotal,
      currency: effectiveCurrency,
    };
    // M-01 fix: await the write so errors are caught and the snapshot is
    // available for the "Original" tab on this first visit without a reload.
    const { error: snapErr } = await supabase
      .from('quotes')
      .update({ original_summary_snapshot: snapshotData })
      .eq('id', id)
      .is('original_summary_snapshot', null);
    if (snapErr) {
      console.error('[summary] snapshot write failed:', snapErr.message);
    } else {
      // Use the freshly written snapshot so Original tab appears on first visit.
      (snapshotRow as any).original_summary_snapshot = snapshotData;
    }
  }

  // The snapshot shown in the "Original" tab: prefer the existing DB snapshot
  // (already captured on a prior visit) so we never overwrite the true original.
  // After a successful first-write above, snapshotRow now carries the new snapshot.
  const resolvedSnapshotData = (snapshotRow as any)?.original_summary_snapshot ?? null;
  const originalSnapshot = resolvedSnapshotData as {
    capturedAt: string;
    materialMarginPercent: number;
    labourMarginPercent: number;
    components: Array<{ id: string; name: string; materialCost: number; labourCost: number; total: number }>;
    totalMaterials: number;
    totalLabour: number;
    materialMargin: number;
    labourMargin: number;
    subtotalWithMargins: number;
    customLinesTotal: number;
    adjustedSubtotal: number;
    adjustedTax: number;
    adjustedGrandTotal: number;
    currency: string;
  } | null;

  const showOriginalView = view === 'original' && !!originalSnapshot;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {backLabel}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{quote.customer_name}</h1>
            {quote.job_name && <p className="text-sm text-slate-500 mt-0.5">{quote.job_name}</p>}
            {(quote as any).acceptance_token_expires_at && (
              <div className="mt-2">
                <QuoteExpiryEditor
                  quoteId={id}
                  expiresAt={(quote as any).acceptance_token_expires_at}
                  isFinalised={!!(quote.accepted_at || quote.declined_at)}
                />
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-orange-600">Quote #{quote.quote_number}</span>
        </div>
      </div>

      {activityCardEnabled && (
        <ActivityCard
          workspaceSlug={workspaceSlug}
          quoteId={id}
          companyId={quote.company_id}
          customerName={quote.customer_name}
          quoteNumber={quote.quote_number}
          revisionRequests={revisionRequests}
        />
      )}

      <SummaryTabs
        workspaceSlug={workspaceSlug}
        quoteId={id}
        customerLines={(allCustomerLines || []).map(l => ({ id: l.id, custom_text: l.custom_text, custom_amount: l.custom_amount, show_price: l.show_price, is_visible: l.is_visible, include_in_total: l.include_in_total }))}
        hasCustomerQuote={hasCustomerQuote}
        quote={{
          quote_number: quote.quote_number,
          customer_name: quote.customer_name,
          job_name: quote.job_name,
          site_address: quote.site_address,
          created_at: quote.created_at,
          tax_rate: quote.tax_rate,
          cq_company_name: quote.cq_company_name,
          cq_company_address: quote.cq_company_address,
          cq_company_phone: quote.cq_company_phone,
          cq_company_email: quote.cq_company_email,
          cq_company_logo_url: quote.cq_company_logo_url,
          cq_footer_text: quote.cq_footer_text,
        }}
        effectiveCurrency={effectiveCurrency}
        hasLaborSheet={hasLaborSheet}
        laborLines={(laborSheetLines || []).map(l => ({ id: l.id, custom_text: l.custom_text, custom_amount: l.custom_amount, show_price: l.show_price, is_visible: l.is_visible, include_in_total: l.include_in_total }))}
        summaryHeaderSlot={
          !!originalSnapshot ? (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
              <Link
                href={`/${workspaceSlug}/quotes/${id}/summary`}
                title="Your current up to date quote summary"
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                  !showOriginalView
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-white hover:text-orange-600 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
                }`}
              >
                Current
              </Link>
              <Link
                href={`/${workspaceSlug}/quotes/${id}/summary?view=original`}
                title="The first saved Quote Summary version"
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                  showOriginalView
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-white hover:text-orange-600 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
                }`}
              >
                Original
              </Link>
            </div>
          ) : null
        }
        summaryActions={
          <>
            {quote.status === 'draft' && (
              <CurrencySelector quoteId={id} currentCurrency={quote.currency} companyDefaultCurrency={companyDefaultCurrency} workspaceSlug={workspaceSlug} />
            )}
            {/*
              "Edit Quote" goes back to whichever screen IS the master source
              for this quote's mode. For manual/digital that's the quote
              builder route (which itself routes digital onward to /build);
              for blank quotes the customer quote editor IS the master source
              of line items, so we route there directly.
            */}
            <Link
              href={
                quote.entry_mode === 'blank'
                  ? `/${workspaceSlug}/quotes/${id}/blank-build`
                  : `/${workspaceSlug}/quotes/${id}`
              }
              title="Edit Quote"
              className="icon-btn border-slate-300 bg-white"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </Link>
            <form action={async () => {
              'use server';
              const { cloneQuote } = await import('../../actions');
              const newId = await cloneQuote(id, quote.customer_name + ' (Copy)');
              redirect(`/${workspaceSlug}/quotes/${newId}`);
            }}>
              <button type="submit" title="Clone Quote" className="icon-btn border-slate-300 bg-white">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </form>
            <DownloadSummaryPDFButton quoteNumber={quote.quote_number} customerName={quote.customer_name} />
            <WithdrawQuoteButton
              quoteId={id}
              hasActiveToken={!!quote.acceptance_token && !quote.withdrawn_at}
              isAlreadyWithdrawn={!!quote.withdrawn_at}
              acceptedAt={quote.accepted_at ?? null}
              declinedAt={quote.declined_at ?? null}
            />
            {quote.accepted_at ? (
              <ReopenQuoteButton quoteId={id} state="accepted" />
            ) : quote.declined_at ? (
              <ReopenQuoteButton quoteId={id} state="declined" />
            ) : quote.withdrawn_at ? (
              <ReopenQuoteButton quoteId={id} state="withdrawn" />
            ) : null}
            <SendQuoteButton
              quoteId={id}
              workspaceSlug={workspaceSlug}
              existingToken={quote.acceptance_token && !quote.withdrawn_at ? quote.acceptance_token : null}
              existingExpiresAt={(quote as any).acceptance_token_expires_at ?? null}
              hasCustomerQuote={hasCustomerQuote}
              emailTemplates={emailTemplates || []}
              canFollowups={entitlements.features.followups}
              canEmail={entitlements.features.email_send}
              sendTestTipSeen={sendTestTipSeen}
              libraryFiles={libraryPickerFiles}
              libraryLocked={!attachmentsEnabled}
              quoteFiles={(filesData || []).map((f) => ({
                id: f.id,
                name: f.file_name,
                fileSize: f.file_size,
              }))}
              quoteMeta={{
                customerName: quote.customer_name,
                quoteNumber: quote.quote_number,
                jobName: quote.job_name,
                companyName: quote.cq_company_name || company?.name || null,
                quoteDate: new Date(quote.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' }),
              }}
              showMarginInPreview={!!(quote as { show_margin_in_preview?: boolean | null }).show_margin_in_preview}
            />
          </>
        }
      >

      <div data-pdf-content className="p-12 bg-white">
        {/* PDF Header */}
        <div className="mb-8 pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">
            Quote #{quote.quote_number || 'DRAFT'} - Summary
          </h1>
          {showOriginalView && originalSnapshot && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                ðŸ”’ Original - captured {new Date(originalSnapshot.capturedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}
          <p className="text-base text-slate-700 mb-2">{quote.customer_name}</p>
          {quote.job_name && <p className="text-sm text-slate-500 mb-2">{quote.job_name}</p>}
        </div>

      <div className="space-y-10">
        {roofAreas.map(area => {
          const areaComps = mainComps.filter(c => c.quote_roof_area_id === area.id);
          return (
            <div key={area.id}>
              <h3 className="font-semibold text-slate-900 mb-4">{area.label} - {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}</h3>
              {areaComps.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-300">
                    <th className="pb-2 font-medium">Component</th><th className="pb-2 text-right font-medium">Entries</th><th className="pb-2 text-right font-medium">Total Qty</th>
                    <th className="pb-2 text-right font-medium">Item Cost</th><th className="pb-2 text-right font-medium">Labour</th><th className="pb-2 text-right font-medium">Total</th>
                  </tr></thead>
                  <tbody>{areaComps.map(c => {
                    // Convert canonical metric quantity into the quote's display
                    // system so an Imperial quote shows ft / ft2 / RS, not m / m2.
                    const sys = normalizeMeasurementSystem(quote.measurement_system);
                    const rawQty = c.final_quantity ?? 0;
                    let displayQty = rawQty;
                    if (c.measurement_type === 'area') {
                      if (sys === 'imperial_ft') displayQty = convertAreaFt2(rawQty);
                      else if (sys === 'imperial_rs') displayQty = Number(convertArea(rawQty));
                    } else if (c.measurement_type === 'lineal') {
                      if (sys !== 'metric') displayQty = convertLinear(rawQty);
                    }
                    return (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-3">{c.name}</td>
                      <td className="py-3 text-right">{(entries[c.id] ?? []).length}</td>
                      <td className="py-3 text-right">{c.priced_quantity != null && Math.abs(c.priced_quantity - displayQty) > 0.001 ? (<>{c.priced_quantity.toFixed(0)} <span className="italic text-slate-400">({displayQty.toFixed(2)})</span></>) : (<>{displayQty.toFixed(1)} {getUnitLabel(c.measurement_type as any, quote.measurement_system)}</>)}</td>
                      <td className="py-3 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                      <td className="py-3 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}</td>
                    </tr>
                  );
                  })}</tbody>
                </table>
              ) : <p className="text-xs text-slate-400">No components</p>}
            </div>
          );
        })}

        {extraComps.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">{extrasHeading}</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-300">
                <th className="pb-2 font-medium">{isGenericNoArea ? 'Item' : 'Extra'}</th><th className="pb-2 text-right font-medium">Entries</th><th className="pb-2 text-right font-medium">Total Qty</th>
                <th className="pb-2 text-right font-medium">Item Cost</th><th className="pb-2 text-right font-medium">Labour</th><th className="pb-2 text-right font-medium">Total</th>
              </tr></thead>
              <tbody>{extraComps.map(c => {
                const sys = normalizeMeasurementSystem(quote.measurement_system);
                const rawQty = c.final_quantity ?? 0;
                let displayQty = rawQty;
                if (c.measurement_type === 'area') {
                  if (sys === 'imperial_ft') displayQty = convertAreaFt2(rawQty);
                  else if (sys === 'imperial_rs') displayQty = Number(convertArea(rawQty));
                } else if (c.measurement_type === 'lineal') {
                  if (sys !== 'metric') displayQty = convertLinear(rawQty);
                }
                return (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-3">{c.name}</td>
                  <td className="py-3 text-right">{(entries[c.id] ?? []).length}</td>
                  <td className="py-3 text-right">{c.priced_quantity != null && Math.abs(c.priced_quantity - displayQty) > 0.001 ? (<>{c.priced_quantity.toFixed(0)} <span className="italic text-slate-400">({displayQty.toFixed(2)})</span></>) : (<>{displayQty.toFixed(1)} {getUnitLabel(c.measurement_type as any, quote.measurement_system)}</>)}</td>
                  <td className="py-3 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                  <td className="py-3 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                  <td className="py-3 text-right font-medium">{formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}</td>
                </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}

        {/* Custom Extra Items */}
        {customLines && customLines.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Custom Extra Items</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-300">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr></thead>
              <tbody>{customLines.map(line => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-3">{line.custom_text}</td>
                  <td className="py-3 text-right font-medium">{formatCurrency(line.custom_amount || 0, effectiveCurrency)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {showOriginalView && originalSnapshot ? (
          // â”€â”€ ORIGINAL TAB â”€â”€ Read-only view from the first-save snapshot
          <div className="pt-4 space-y-4">
            <div className="pt-4 border-t border-slate-300 space-y-4">
              <div className="flex justify-between text-base"><span className="text-slate-900">Total Item Cost</span><span className="text-slate-900 text-right">{formatCurrency(originalSnapshot.totalMaterials, originalSnapshot.currency)}</span></div>
              <div className="flex justify-between text-base"><span className="text-slate-900">Total Labour</span><span className="text-slate-900 text-right">{formatCurrency(originalSnapshot.totalLabour, originalSnapshot.currency)}</span></div>
              {(originalSnapshot.materialMargin > 0 || originalSnapshot.labourMargin > 0) && (
                <div className="flex justify-between text-base text-slate-500">
                  <span>Margins ({originalSnapshot.materialMarginPercent}% mat / {originalSnapshot.labourMarginPercent}% lab)</span>
                  <span className="text-right">+{formatCurrency(originalSnapshot.materialMargin + originalSnapshot.labourMargin, originalSnapshot.currency)}</span>
                </div>
              )}
              {originalSnapshot.customLinesTotal > 0 && (
                <div className="flex justify-between text-base"><span className="text-slate-900">Custom Items</span><span className="text-slate-900 text-right">{formatCurrency(originalSnapshot.customLinesTotal, originalSnapshot.currency)}</span></div>
              )}
              <div className="flex justify-between text-base border-t border-slate-300 pt-4"><span className="text-slate-900">Subtotal</span><span className="text-slate-900 text-right">{formatCurrency(originalSnapshot.adjustedSubtotal, originalSnapshot.currency)}</span></div>
              <div className="flex justify-between text-base">
                <span className="text-slate-900">Tax</span>
                <span className="text-slate-900 text-right">{formatCurrency(originalSnapshot.adjustedTax, originalSnapshot.currency)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t border-slate-300 pt-4"><span className="text-slate-900">Grand Total</span><span className="text-slate-900 text-right">{formatCurrency(originalSnapshot.adjustedGrandTotal, originalSnapshot.currency)}</span></div>
            </div>
            <p className="text-xs text-slate-400 italic">This is a read-only snapshot of the quote as it was when first saved. Switch to &quot;Current&quot; to see live values.</p>
          </div>
        ) : (
          // â”€â”€ CURRENT TAB (default) â”€â”€ Live computed values
          <div className="pt-6 border-t border-slate-300 space-y-4">
            <div className="flex justify-between text-base"><span className="text-slate-900">Total Item Cost</span><span className="text-slate-900 text-right">{formatCurrency(totals.totalMaterials, effectiveCurrency)}</span></div>
            <div className="flex justify-between text-base"><span className="text-slate-900">Total Labour</span><span className="text-slate-900 text-right">{formatCurrency(totals.totalLabour, effectiveCurrency)}</span></div>
            {(totals.materialMargin > 0 || totals.labourMargin > 0) && <div className="flex justify-between text-base text-slate-500"><span>Margins</span><span className="text-right">+{formatCurrency(totals.materialMargin + totals.labourMargin, effectiveCurrency)}</span></div>}
            {customLinesTotal > 0 && <div className="flex justify-between text-base"><span className="text-slate-900">Custom Items</span><span className="text-slate-900 text-right">{formatCurrency(customLinesTotal, effectiveCurrency)}</span></div>}
            <div className="flex justify-between text-base border-t border-slate-300 pt-4"><span className="text-slate-900">Subtotal</span><span className="text-slate-900 text-right">{formatCurrency(adjustedSubtotal, effectiveCurrency)}</span></div>
            {summaryTaxLines.map((tl) => (
              <div key={tl.id} className="flex justify-between text-base">
                <span className="text-slate-900">{tl.name} ({tl.rate_percent}%)</span>
                <span className="text-slate-900 text-right">{formatCurrency(tl.amount, effectiveCurrency)}</span>
              </div>
            ))}
            {summaryTaxLines.length > 1 && (
              <div className="flex justify-between text-base border-t border-slate-300 pt-2">
                <span className="text-slate-900">Tax total</span>
                <span className="text-slate-900 text-right">{formatCurrency(adjustedTax, effectiveCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold border-t border-slate-300 pt-4"><span className="text-slate-900">Grand Total</span><span className="text-slate-900 text-right">{formatCurrency(adjustedGrandTotal, effectiveCurrency)}</span></div>
          </div>
        )}

        {/* Files & Documents (always visible so users can add more supporting files from here) */}
        <SummaryFilesPanel
          quoteId={id}
          companyId={quote.company_id}
          isOverStorage={entitlements.isOverStorage}
          files={allFiles.map((f) => ({
            id: f.id,
            file_name: f.file_name,
            file_type: f.file_type as string,
            file_size: f.file_size,
            storage_path: f.storage_path,
            url: f.url,
          }))}
        />
      </div>
      </div>
      </SummaryTabs>

      {/* Notes panel -- always visible below the main summary content */}
      <QuoteNotesPanel quoteId={id} initialNotes={quoteNotes} currentUserFullName={currentUserFullName} />

    </div>
  );
}
