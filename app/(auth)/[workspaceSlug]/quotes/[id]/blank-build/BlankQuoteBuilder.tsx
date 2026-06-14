'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { QuoteRow, CustomerQuoteTemplateRow } from '@/app/lib/types';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { saveCustomerQuoteLines, saveCustomerQuoteBranding } from '../../actions';
import { saveQuoteTaxes, seedQuoteTaxesFromCompanyDefaults } from '@/app/lib/taxes/actions';
import { computeTaxLines } from '@/app/lib/taxes/types';
import type { QuoteTaxRow } from '@/app/lib/taxes/types';
// QuoteTaxRow stays imported because the `initialTaxes` prop shape uses it,
// even though the in-memory tax editing flow uses EditableTax.
import { TaxEditor, type EditableTax } from '@/app/components/TaxEditor';
import { EditHeaderModal } from '../customer-edit/EditHeaderModal';
import { EditFooterModal } from '../customer-edit/EditFooterModal';
import { AddLineItemModal, type LineItemPayload } from '@/app/components/AddLineItemModal';

/**
 * Blank Quote Builder.
 *
 * Purpose-built screen for quotes with `entry_mode='blank'`. Reads and
 * writes the same `customer_quote_lines` rows the customer quote editor
 * uses, so the Summary, Send Quote, Clone, etc. all work without any
 * mode-specific branches. The visual + verbal framing is different
 * though:
 *
 *   - Header reads "Build your quote", not "Edit customer quote".
 *   - Lines are referred to as "quote lines", not "customer lines",
 *     because in blank mode there's no master-vs-customer distinction.
 *   - The customer-edit screen's per-line `is_visible` / `include_in_total`
 *     toggles aren't surfaced here \u2014 they would only confuse the user;
 *     they're effectively always on for blank-mode lines.
 *   - The customer-edit screen's "show units" toggle isn't surfaced
 *     because there are no underlying components/units to show.
 *
 * If the user wants to later create a *different* customer-facing view of
 * a blank quote (e.g. group lines, change descriptions, hide a price),
 * they can still open the customer quote editor from the Summary. This
 * builder is the master entry point.
 */

/**
 * `line_type` matches the DB enum `line_type` which includes
 * `'roof_area_header'` as well - those rows are filtered out by the
 * blank-quote loader but the prop type still has to admit them so the
 * page boundary stays typed.
 */
interface SavedLine {
  id: string;
  line_type: 'component' | 'custom' | 'roof_area_header';
  quote_component_id: string | null;
  custom_text: string | null;
  custom_amount: number | null;
  show_price: boolean | null;
  show_units: boolean | null;
  is_visible: boolean | null;
  include_in_total: boolean | null;
  sort_order: number | null;
  quantity?: number | null;
  unit_price?: number | null;
  quantity_text?: string | null;
}

interface QuoteLine {
  id: string;
  text: string;
  /** Free-text description (column 2). */
  quantityText: string | null;
  amount: number;
  /** Per-unit price when quantity column is active. Null = legacy. */
  unitPrice: number | null;
  /** Numeric quantity when quantity column is active. Default 1. */
  qty: number;
  showPrice: boolean;
}

interface Props {
  quote: QuoteRow;
  savedLines: SavedLine[];
  templates: CustomerQuoteTemplateRow[];
  workspaceSlug: string;
  currency: string;
  collections?: { id: string; name: string }[];
  componentLibrary?: { id: string; name: string; collection_id: string | null }[];
  catalogs?: { id: string; name: string }[];
  defaultLogoUrl: string | null;
  initialTaxes: QuoteTaxRow[];
  companyTaxes: { id: string; name: string; rate_percent: number }[];
}

function tempLineId(): string {
  return `blank-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BlankQuoteBuilder({
  quote,
  savedLines,
  templates,
  workspaceSlug,
  currency,
  defaultLogoUrl,
  initialTaxes,
  companyTaxes,
  collections = [],
  componentLibrary = [],
  catalogs = [],
}: Props) {
  const router = useRouter();

  // Branding state, derived from the quote row (carries between saves).
  const [companyName, setCompanyName] = useState(quote.cq_company_name || '');
  const [companyAddress, setCompanyAddress] = useState(quote.cq_company_address || '');
  const [companyPhone, setCompanyPhone] = useState(quote.cq_company_phone || '');
  const [companyEmail, setCompanyEmail] = useState(quote.cq_company_email || '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(quote.cq_company_logo_url || defaultLogoUrl || '');
  const [footerText, setFooterText] = useState(quote.cq_footer_text || '');

  // Taxes \u2014 same shape as the customer editor uses; the TaxEditor expects
  // EditableTax[] so we mirror its dbId + source_tax_id metadata.
  const [taxes, setTaxes] = useState<EditableTax[]>(
    initialTaxes.map((t) => ({
      id: t.id,
      dbId: t.id,
      source_tax_id: t.source_tax_id,
      name: t.name,
      rate_percent: Number(t.rate_percent),
      include_in_quote: t.include_in_quote,
      include_in_labor: t.include_in_labor,
    })),
  );

  // Lines: hydrate ONCE from server props using the same one-shot guard the
  // customer editor uses, so a parent re-render (router.refresh, prop ref
  // change with identical content) can't wipe in-progress edits.
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const initial: QuoteLine[] = savedLines
      .map((row) => ({
        id: row.id,
        text: row.custom_text ?? '',
        quantityText: row.quantity_text ?? null,
        amount: Number(row.custom_amount) || 0,
        unitPrice: row.unit_price ?? null,
        qty: row.quantity ?? 1,
        showPrice: row.show_price ?? true,
      }));
    setLines(initial);
  }, [savedLines]);

  // ---- Mutations -----------------------------------------------------------

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  /** Unified handler called by AddLineItemModal for all three tabs. */
  const handleAddLineItem = useCallback((payloads: LineItemPayload[]) => {
    setLines((prev) => [
      ...prev,
      ...payloads.map((p, i) => ({
        id: `${tempLineId()}-${i}`,
        text: p.title,
        quantityText: p.description,
        amount: p.lineTotal,
        unitPrice: p.unitPrice,
        qty: p.quantity,
        showPrice: p.showPrice,
      })),
    ]);
    setIsDirty(true);
  }, []);

  const updateLine = useCallback((id: string, patch: Partial<QuoteLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setIsDirty(true);
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setIsDirty(true);
  }, []);

  const moveLine = useCallback((id: string, direction: -1 | 1) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const next = idx + direction;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
    setIsDirty(true);
  }, []);

  // ---- Templates -----------------------------------------------------------

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  function applyTemplate(templateId: string) {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setCompanyName(tpl.company_name || '');
    setCompanyAddress(tpl.company_address || '');
    setCompanyPhone(tpl.company_phone || '');
    setCompanyEmail(tpl.company_email || '');
    setCompanyLogoUrl(tpl.company_logo_url || defaultLogoUrl || '');
    setFooterText(tpl.footer_text || '');
    setIsDirty(true);
  }

  // ---- Totals --------------------------------------------------------------

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
    [lines],
  );

  // computeTaxLines only needs the Pick<> subset; build it directly so the
  // memo doesn't fight TypeScript over partial QuoteTaxRow shapes.
  const { taxLines, grandTotal } = useMemo(() => {
    // EditableTax's include flags are optional; coalesce to boolean for
    // computeTaxLines, whose Pick<> shape expects strict booleans.
    const filtered = taxes.map((t) => ({
      id: t.dbId ?? t.id,
      name: t.name,
      rate_percent: t.rate_percent,
      include_in_quote: t.include_in_quote ?? true,
      include_in_labor: t.include_in_labor ?? false,
    }));
    const { lines: tl, total: tt } = computeTaxLines(filtered, subtotal, 'quote');
    return { taxLines: tl, grandTotal: subtotal + tt };
  }, [taxes, subtotal]);

  // ---- Save ----------------------------------------------------------------

  const [showHeader, setShowHeader] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showQuantityColumn, setShowQuantityColumn] = useState(
    !!(quote as { show_quantity_column?: boolean }).show_quantity_column
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Validate taxes BEFORE writing anything so we don't half-save.
      for (const t of taxes) {
        if (!t.name.trim()) throw new Error('Each tax must have a name');
        if (!Number.isFinite(t.rate_percent) || t.rate_percent < 0 || t.rate_percent > 100) {
          throw new Error(`Invalid rate for "${t.name}": must be between 0 and 100`);
        }
      }
      // Sort + persist in display order.
      const lineData = lines.map((l, idx) => ({
        id: l.id,
        lineType: 'custom' as const,
        componentId: undefined,
        text: l.text,
        quantityText: l.quantityText,
        amount: Number(l.amount) || 0,
        showPrice: l.showPrice,
        showUnits: false,
        sortOrder: idx,
        isVisible: true,
        includeInTotal: true,
        quantity: l.qty ?? 1,
        unitPrice: l.unitPrice ?? null,
      }));
      await Promise.all([
        saveCustomerQuoteLines(quote.id, lineData, showQuantityColumn),
        saveCustomerQuoteBranding(quote.id, {
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          companyLogoUrl,
          footerText,
        }),
        saveQuoteTaxes(
          quote.id,
          // QuoteTaxInput wants strict booleans; coalesce here so an
          // EditableTax row that hasn't been ticked yet doesn't trip
          // the TS check.
          taxes.map((t, idx) => ({
            id: t.dbId,
            source_tax_id: t.source_tax_id ?? null,
            name: t.name,
            rate_percent: t.rate_percent,
            sort_order: idx,
            include_in_quote: t.include_in_quote ?? true,
            include_in_labor: t.include_in_labor ?? false,
          })),
        ),
      ]);
      setIsDirty(false);
      setLastSavedAt(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [
    quote.id,
    lines,
    taxes,
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    companyLogoUrl,
    footerText,
  ]);

  const handleSaveAndContinue = useCallback(async () => {
    await handleSave();
    router.push(`/${workspaceSlug}/quotes/${quote.id}/summary`);
  }, [handleSave, router, workspaceSlug, quote.id]);

  // ---- Render --------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header band */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/${workspaceSlug}/quotes`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">Build your quote</h1>
          <p className="text-sm text-slate-500 mt-1">
            {quote.customer_name}{quote.job_name ? ` · ${quote.job_name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500 hidden sm:inline">
            {saving
              ? 'Saving…'
              : isDirty
              ? 'Unsaved changes'
              : lastSavedAt
              ? `Saved ${Math.max(1, Math.floor((Date.now() - lastSavedAt.getTime()) / 1000))}s ago`
              : 'Not saved yet'}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-4 py-1.5 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleSaveAndContinue}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save & continue to summary'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
        {/* Left: controls */}
        <div className="space-y-6">
          {/* Template picker + header/footer edit */}
          <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Header &amp; Footer</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Apply a saved template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedTemplateId(id);
                  if (id) applyTemplate(id);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="">- Choose a customer quote template -</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Pre-fills header (logo, company info) and footer text from a saved template. You can still edit either after applying.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowHeader(true)}
                className="flex-1 px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Edit header
              </button>
              <button
                type="button"
                onClick={() => setShowFooter(true)}
                className="flex-1 px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Edit footer
              </button>
            </div>
          </section>

          {/* Quote lines */}
          <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Quote lines</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showQuantityColumn}
                    onChange={(e) => { setShowQuantityColumn(e.target.checked); setIsDirty(true); }}
                    className="w-4 h-4 rounded text-orange-600"
                  />
                  <span className="text-xs text-slate-600">Qty column</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddLine(true)}
                  className="px-3 py-1.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.4)]"
                >
                  + Add Line Item
                </button>
              </div>
            </div>
            {lines.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No lines yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click <strong>Add line</strong> to start building your quote. Lines you add here populate both the summary and the customer-facing quote.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {lines.map((line, idx) => (
                  <li
                    key={line.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2"
                  >
                    <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
                      <input
                        type="text"
                        value={line.text}
                        onChange={(e) => updateLine(line.id, { text: e.target.value })}
                        placeholder="Description (e.g. Supply & install roofing, $/m² included)"
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.amount === 0 ? '' : line.amount}
                        onChange={(e) =>
                          updateLine(line.id, {
                            amount: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                        placeholder="0.00"
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 text-right"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveLine(line.id, -1)}
                          disabled={idx === 0}
                          title="Move up"
                          className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLine(line.id, 1)}
                          disabled={idx === lines.length - 1}
                          title="Move down"
                          className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          title="Delete line"
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={line.showPrice}
                        onChange={(e) => updateLine(line.id, { showPrice: e.target.checked })}
                        className="w-4 h-4 text-orange-600 rounded"
                      />
                      Show price to customer
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Taxes */}
          <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Taxes</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stack multiple taxes if needed. Rates are saved per-quote so they don&apos;t change your company defaults.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Reset taxes on this quote to your current company defaults? Per-quote edits will be lost.')) return;
                  await seedQuoteTaxesFromCompanyDefaults(quote.id);
                  router.refresh();
                }}
                className="text-xs text-slate-500 hover:text-orange-600 underline whitespace-nowrap"
              >
                Reset to defaults
              </button>
            </div>
            <TaxEditor
              taxes={taxes}
              onChange={(next) => { setTaxes(next); setIsDirty(true); }}
              showAudienceToggles={false}
              disabled={saving}
            />
            {companyTaxes.length > 0 && (
              <div className="pt-3 border-t border-slate-200">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Quick add from company defaults</p>
                <div className="flex flex-wrap gap-2">
                  {companyTaxes
                    .filter((ct) => !taxes.some((t) => t.source_tax_id === ct.id))
                    .map((ct) => (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => {
                          setTaxes((prev) => [
                            ...prev,
                            {
                              id: `new-${ct.id}`,
                              dbId: undefined,
                              source_tax_id: ct.id,
                              name: ct.name,
                              rate_percent: ct.rate_percent,
                              include_in_quote: true,
                              include_in_labor: false,
                            },
                          ]);
                          setIsDirty(true);
                        }}
                        className="text-xs px-2 py-1 rounded-full border border-slate-200 hover:border-orange-300 hover:text-orange-600"
                      >
                        + {ct.name} ({ct.rate_percent}%)
                      </button>
                    ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right: live preview. Mirrors the canonical CustomerQuotePreview
            layout from SummaryTabs.tsx so what the user sees here is what
            lands on the summary and the customer-facing quote URL. The
            HTML is duplicated rather than imported because that component
            takes its data from saved DB rows; we render from local state
            for live feedback. Keep the two layouts in sync if either side
            changes. */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Preview</h2>
          <div className="bg-white rounded-xl border border-black p-12 space-y-8">
            {/* Header */}
            <div className="border-b-2 border-black pb-6 mb-6">
              <div className="flex justify-end mb-6">
                {companyLogoUrl ? (
                  <img src={companyLogoUrl} alt="Logo" className="h-16 object-contain" />
                ) : (
                  <div className="w-32 h-16 border-2 border-dashed border-black rounded flex items-center justify-center">
                    <span className="text-xs text-black">Logo</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold text-black mb-4">
                    QUOTE #{quote.quote_number ?? 'DRAFT'}
                  </h1>
                  <div className="space-y-2">
                    <p className="text-base text-black">
                      <span className="font-semibold">Client:</span> {quote.customer_name}
                    </p>
                    {quote.job_name && (
                      <p className="text-base text-black">
                        <span className="font-semibold">Job:</span> {quote.job_name}
                      </p>
                    )}
                    {quote.site_address && (
                      <p className="text-base text-black">
                        <span className="font-semibold">Site:</span> {quote.site_address}
                      </p>
                    )}
                    <p className="text-base text-black">
                      <span className="font-semibold">Date:</span>{' '}
                      {new Date(quote.created_at).toLocaleDateString('en-NZ', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                {(companyName || companyAddress || companyPhone || companyEmail) && (
                  <div className="text-right space-y-1">
                    {companyName && (
                      <p className="font-semibold text-base text-black">{companyName}</p>
                    )}
                    {companyAddress && <p className="text-sm text-black">{companyAddress}</p>}
                    {companyPhone && <p className="text-sm text-black">{companyPhone}</p>}
                    {companyEmail && <p className="text-sm text-black">{companyEmail}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-3">
              {lines.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-4 text-center">
                  No lines yet. Add some from the &quot;Quote lines&quot; panel.
                </p>
              ) : (
                lines.map((line) => (
                  <div
                    key={`prev-${line.id}`}
                    className="flex items-start justify-between py-3 border-b border-black"
                  >
                    <p className="text-black">
                      {line.text || <span className="text-slate-400 italic">Untitled line</span>}
                    </p>
                    {line.showPrice && (
                      <p className="text-black font-medium whitespace-nowrap ml-4">
                        {formatCurrency(line.amount, currency)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            {lines.length > 0 && (
              <div className="space-y-3 pt-4 border-t-2 border-black">
                <div className="flex justify-between text-base">
                  <span className="text-black">Subtotal</span>
                  <span className="font-medium text-black">
                    {formatCurrency(subtotal, currency)}
                  </span>
                </div>
                {taxLines.map((tl) => (
                  <div key={`tax-${tl.id}`} className="flex justify-between text-base">
                    <span className="text-black">
                      {tl.name} ({tl.rate_percent}%)
                    </span>
                    <span className="font-medium text-black">
                      {formatCurrency(tl.amount, currency)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-xl font-bold border-t-2 border-black pt-3">
                  <span className="text-black">Total</span>
                  <span className="text-black">{formatCurrency(grandTotal, currency)}</span>
                </div>
              </div>
            )}

            {footerText && (
              <div className="pt-6 border-t border-black">
                <p className="text-sm text-black italic whitespace-pre-wrap">{footerText}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header + Footer modals reuse the customer-edit ones \u2014 same data
          model, same field set. */}
      {showHeader && (
        <EditHeaderModal
          companyName={companyName}
          companyAddress={companyAddress}
          companyPhone={companyPhone}
          companyEmail={companyEmail}
          companyLogoUrl={companyLogoUrl}
          onSave={(d) => {
            setCompanyName(d.companyName);
            setCompanyAddress(d.companyAddress);
            setCompanyPhone(d.companyPhone);
            setCompanyEmail(d.companyEmail);
            setCompanyLogoUrl(d.companyLogoUrl);
            setIsDirty(true);
            setShowHeader(false);
          }}
          onCancel={() => setShowHeader(false)}
        />
      )}
      {showFooter && (
        <EditFooterModal
          footerText={footerText}
          onSave={(t) => {
            setFooterText(t);
            setIsDirty(true);
            setShowFooter(false);
          }}
          onCancel={() => setShowFooter(false)}
        />
      )}

      {/* Add Line Item modal — shared invoice-style modal */}
      {showAddLine && (
        <AddLineItemModal
          workspaceSlug={workspaceSlug}
          currency={currency}
          catalogs={catalogs}
          collections={collections}
          componentLibrary={componentLibrary}
          onAdd={handleAddLineItem}
          onClose={() => setShowAddLine(false)}
        />
      )}
    </div>
  );
}
