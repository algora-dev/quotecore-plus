'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import {
  searchUserQuotes,
  loadQuoteStoryline,
  type QuoteSearchRow,
  type StorylineData,
} from './actions';
import { formatAuditAsText, type CalcAudit } from '@/app/lib/pricing/calcTracer';
import { formatCurrency } from '@/app/lib/currency/currencies';

// ─── Status badge styles (matches DESIGN_SYSTEM.md) ───

const QUOTE_STATUS_BADGE: Record<string, string> = {
  draft:      'bg-slate-100 text-slate-500 border-slate-200',
  confirmed:  'bg-blue-100 text-blue-700 border-blue-200',
  sent:       'bg-orange-100 text-orange-700 border-orange-200',
  accepted:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  declined:   'bg-red-100 text-red-700 border-red-200',
  expired:    'bg-slate-100 text-slate-400 border-slate-100',
  archived:   'bg-slate-100 text-slate-400 border-slate-100',
};

const STATUS_FILTERS = ['all', 'draft', 'sent', 'accepted', 'declined', 'expired'] as const;

// ─── Main Component ─────────────────────────────────

export function QuotesTab({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<QuoteSearchRow[] | null>(null);
  const [loading, startLoad] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const doSearch = useCallback(() => {
    startLoad(async () => {
      const res = await searchUserQuotes(companyId, {
        query: searchQuery || undefined,
        status: statusFilter,
      });
      if (res.ok) {
        setRows(res.rows);
      } else {
        setRows([]);
      }
    });
  }, [companyId, searchQuery, statusFilter]);

  useEffect(() => {
    doSearch();
  }, [doSearch]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Quotes</h2>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Search by customer or job name…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Results — scrollable to avoid pushing page when user has many quotes */}
      {loading && rows === null ? (
        <p className="text-sm text-slate-500">Loading quotes…</p>
      ) : rows !== null && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No quotes found.</p>
        </div>
      ) : rows !== null && rows.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelectedQuoteId(q.id)}
              className="block w-full text-left rounded-xl border bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group border-slate-200"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {q.customer_name || 'Unknown customer'}
                    </span>
                    {q.job_name && (
                      <span className="text-xs text-slate-400 truncate">· {q.job_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>#{q.quote_number ?? '—'}</span>
                    <span>{q.component_count} component{q.component_count !== 1 ? 's' : ''}</span>
                    <span>Updated {new Date(q.updated_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatCurrency(q.total_material + q.total_labour, q.currency ?? 'GBP')}
                    </div>
                    <div className="text-xs text-slate-400">total</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${QUOTE_STATUS_BADGE[q.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    {q.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {/* Storyline modal */}
      {selectedQuoteId && (
        <StorylineModal
          quoteId={selectedQuoteId}
          onClose={() => setSelectedQuoteId(null)}
        />
      )}
    </div>
  );
}

// ─── Storyline Modal ────────────────────────────────

function StorylineModal({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
  const [data, setData] = useState<StorylineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadQuoteStoryline(quoteId)
      .then((res) => {
        if (res.ok) {
          setData(res.data);
        } else {
          setError(res.error);
        }
      })
      .catch((err) => setError(err.message ?? String(err)))
      .finally(() => setLoading(false));
  }, [quoteId]);

  const toggleComponent = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!data) return;
    setExpandedIds(new Set(data.components.map((c) => c.componentId)));
  };

  const collapseAll = () => setExpandedIds(new Set());

  const downloadFullAudit = () => {
    if (!data) return;
    const parts: string[] = [];
    parts.push('QUOTE CALCULATION STORYLINE — FULL EXPORT');
    parts.push('═'.repeat(60));
    parts.push(`Quote: #${data.quote.quoteNumber ?? data.quote.id}`);
    parts.push(`Customer: ${data.quote.customerName}`);
    parts.push(`Job: ${data.quote.jobName ?? 'N/A'}`);
    parts.push(`Status: ${data.quote.status}`);
    parts.push(`Currency: ${data.quote.currency ?? 'GBP'}`);
    parts.push(`Created: ${data.quote.createdAt}`);
    parts.push(`Updated: ${data.quote.updatedAt}`);
    parts.push('');

    for (const c of data.components) {
      const audit = c.calcAudit as CalcAudit | null;
      if (audit) {
        parts.push(formatAuditAsText(audit));
      } else {
        parts.push(`Component: ${c.componentName} (${c.measurementType})`);
        parts.push('  No calc audit data available.');
        parts.push('');
      }
      parts.push('─'.repeat(60));
    }

    const blob = new Blob([parts.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyline-quote-${data.quote.quoteNumber ?? data.quote.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {data ? `Quote #${data.quote.quoteNumber ?? data.quote.id}` : 'Loading…'}
            </h2>
            {data && (
              <p className="text-sm text-slate-500 mt-0.5">
                {data.quote.customerName}
                {data.quote.jobName ? ` · ${data.quote.jobName}` : ''}
                {' · '}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${QUOTE_STATUS_BADGE[data.quote.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  {data.quote.status}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && data.components.length > 0 && (
              <>
                <button
                  onClick={expandAll}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                >
                  Expand all
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                >
                  Collapse all
                </button>
                <button
                  onClick={downloadFullAudit}
                  className="inline-flex items-center rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  Export .txt
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {loading && (
            <p className="text-sm text-slate-500">Loading storyline…</p>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {!loading && !error && data && data.components.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-slate-500">No components in this quote.</p>
            </div>
          )}
          {!loading && !error && data && data.components.length > 0 && (
            <div className="space-y-2">
              {data.components.map((c) => {
                const audit = c.calcAudit as CalcAudit | null;
                const expanded = expandedIds.has(c.componentId);
                const hasOverrides = audit?.hasOverrides ?? false;
                const packMissing = audit?.packDataMissing ?? false;
                const currency = data.quote.currency ?? 'GBP';
                return (
                  <div
                    key={c.componentId}
                    className="rounded-xl border border-slate-200 hover:border-orange-200 transition-colors"
                  >
                    {/* Component header row */}
                    <button
                      onClick={() => toggleComponent(c.componentId)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-900 truncate">{c.componentName}</span>
                        <span className="text-xs text-slate-400">{c.measurementType}</span>
                        {c.areaName && (
                          <span className="text-xs text-slate-400">· {c.areaName}</span>
                        )}
                        {hasOverrides && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                            overridden
                          </span>
                        )}
                        {packMissing && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                            pack data missing
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                        <span>Qty: {Number(c.finalQuantity ?? 0).toFixed(2)}</span>
                        <span>Mat: {formatCurrency(Number(c.materialCost ?? 0), currency)}</span>
                        <span>Lab: {formatCurrency(Number(c.labourCost ?? 0), currency)}</span>
                        <svg
                          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="border-t border-slate-100 px-4 py-4">
                        {audit ? (
                          <AuditDetail audit={audit} />
                        ) : (
                          <p className="text-xs text-slate-400">
                            No audit data available. Save the component to generate a calc trace.
                          </p>
                        )}

                        {/* Raw entries */}
                        {c.entries.length > 0 && (
                          <div className="mt-4">
                            <p className="mb-1.5 text-xs font-medium text-slate-700">Raw entries ({c.entries.length})</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-100 text-slate-400">
                                    <th className="py-1.5 pr-3 font-normal">#</th>
                                    <th className="py-1.5 pr-3 font-normal">Raw value</th>
                                    <th className="py-1.5 pr-3 font-normal">After waste</th>
                                    <th className="py-1.5 pr-3 font-normal">Pitch</th>
                                    <th className="py-1.5 font-normal">Sort</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.entries.map((e, i) => (
                                    <tr key={e.id} className="border-b border-slate-50 text-slate-600">
                                      <td className="py-1.5 pr-3">{i + 1}</td>
                                      <td className="py-1.5 pr-3">{Number(e.rawValue ?? 0).toFixed(4)}</td>
                                      <td className="py-1.5 pr-3">{Number(e.valueAfterWaste ?? 0).toFixed(4)}</td>
                                      <td className="py-1.5 pr-3">{e.pitchDegrees != null ? `${e.pitchDegrees}°` : '—'}</td>
                                      <td className="py-1.5">{e.sortOrder}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Copy/download per component */}
                        {audit && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => navigator.clipboard?.writeText(formatAuditAsText(audit))}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => {
                                const text = formatAuditAsText(audit);
                                const blob = new Blob([text], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `audit-${c.componentName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                            >
                              Download .txt
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Audit Detail (reused from CalcAuditPanel) ──────

function AuditDetail({ audit }: { audit: CalcAudit }) {
  return (
    <div className="space-y-3 text-xs">
      {/* Config */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
        <div>
          <span className="font-medium text-slate-700">Strategy:</span> {audit.pricingStrategy}
        </div>
        <div>
          <span className="font-medium text-slate-700">Source:</span> {audit.source}
        </div>
        <div>
          <span className="font-medium text-slate-700">Waste:</span> {audit.wasteType}
          {audit.wasteType === 'percent' && ` (${audit.wastePercent}%)`}
          {(audit.wasteType === 'fixed' || audit.wasteType === 'fixed_per_segment') && ` (${audit.wasteFixed})`}
        </div>
        <div>
          <span className="font-medium text-slate-700">Pitch:</span> {audit.pitchType} ({audit.pitchDegrees}°)
        </div>
        {audit.packSize != null && (
          <div>
            <span className="font-medium text-slate-700">Pack size:</span> {audit.packSize}
          </div>
        )}
        {audit.packPrice != null && (
          <div>
            <span className="font-medium text-slate-700">Pack price:</span> {audit.packPrice}
          </div>
        )}
        {audit.packCount != null && (
          <div>
            <span className="font-medium text-slate-700">Pack count:</span> {audit.packCount}
          </div>
        )}
      </div>

      {/* Per-entry table */}
      {audit.entries.length > 0 && (
        <div>
          <p className="mb-1.5 font-medium text-slate-700">Per-entry breakdown</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="py-1 pr-3 font-normal">#</th>
                  <th className="py-1 pr-3 font-normal">Raw</th>
                  <th className="py-1 pr-3 font-normal">Metric</th>
                  {audit.entries.some((e) => e.pitchFactor > 1) && (
                    <>
                      <th className="py-1 pr-3 font-normal">Factor</th>
                      <th className="py-1 pr-3 font-normal">After Pitch</th>
                    </>
                  )}
                  <th className="py-1 font-normal">After Waste</th>
                </tr>
              </thead>
              <tbody>
                {audit.entries.map((e, i) => (
                  <tr key={i} className="border-b border-slate-50 text-slate-600">
                    <td className="py-1 pr-3">{i + 1}{e.isCombined ? ' ⓘ' : ''}</td>
                    <td className="py-1 pr-3">{e.rawValue.toFixed(4)}</td>
                    <td className="py-1 pr-3">{e.metricValue.toFixed(4)}</td>
                    {audit.entries.some((en) => en.pitchFactor > 1) && (
                      <>
                        <td className="py-1 pr-3">{e.pitchFactor.toFixed(4)}</td>
                        <td className="py-1 pr-3">{e.afterPitch.toFixed(4)}</td>
                      </>
                    )}
                    <td className="py-1">{e.afterWaste.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
        <div>
          <span className="font-medium text-slate-700">Total qty:</span> {audit.totalQuantity.toFixed(4)}
        </div>
        <div>
          <span className="font-medium text-slate-700">Mat rate:</span> {audit.materialRate}
        </div>
        <div>
          <span className="font-medium text-slate-700">Mat cost:</span> {audit.materialCost.toFixed(2)}
        </div>
        <div>
          <span className="font-medium text-slate-700">Lab rate:</span> {audit.labourRate}
        </div>
        <div>
          <span className="font-medium text-slate-700">Lab cost:</span> {audit.labourCost.toFixed(2)}
        </div>
        <div>
          <span className="font-medium text-slate-700">Total:</span> {audit.totalCost.toFixed(2)}
        </div>
      </div>

      {/* Overrides */}
      {audit.hasOverrides && audit.overrides.length > 0 && (
        <div>
          <p className="mb-1.5 font-medium text-amber-700">Manual overrides ({audit.overrides.length})</p>
          <div className="space-y-1.5">
            {audit.overrides.map((o, i) => (
              <div key={i} className="rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-amber-700">{o.field}</span>
                  <span className="text-slate-400">{new Date(o.timestamp).toLocaleString()}</span>
                </div>
                <div className="mt-0.5">
                  <span className="text-slate-400">From:</span> {String(o.previousValue)} → <span className="text-slate-400">To:</span> {String(o.newValue)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
