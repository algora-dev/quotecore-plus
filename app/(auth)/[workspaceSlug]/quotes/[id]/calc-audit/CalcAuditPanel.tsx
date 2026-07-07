'use client';

import { useState, useEffect } from 'react';
import { loadCalcAuditsForQuote } from './actions';
import { formatAuditAsText, type CalcAudit } from '@/app/lib/pricing/calcTracer';
import { formatCurrency } from '@/app/lib/currency/currencies';

interface Props {
  quoteId: string;
  currency: string;
}

export function CalcAuditPanel({ quoteId, currency }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [components, setComponents] = useState<Array<{
    componentId: string;
    componentName: string;
    measurementType: string;
    finalQuantity: number | null;
    materialCost: number | null;
    labourCost: number | null;
    calcAudit: unknown | null;
  }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    loadCalcAuditsForQuote(quoteId)
      .then((res) => {
        if (res.ok && res.components) {
          setComponents(res.components);
        } else {
          setError(res.error ?? 'Failed to load audit data');
        }
      })
      .catch((err) => setError(err.message ?? String(err)))
      .finally(() => setLoading(false));
  }, [open, quoteId]);

  const toggleComponent = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  const downloadAudit = (componentName: string, audit: CalcAudit) => {
    const text = formatAuditAsText(audit);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calc-audit-${componentName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white">
      {/* Header bar */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">Calculation Audit Trace</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">ADMIN</span>
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          {loading && (
            <p className="text-sm text-slate-400">Loading audit data…</p>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {!loading && !error && components.length === 0 && (
            <p className="text-sm text-slate-400">No components found.</p>
          )}
          {!loading && !error && components.length > 0 && (
            <div className="space-y-2">
              {components.map((c) => {
                const audit = c.calcAudit as CalcAudit | null;
                const expanded = expandedIds.has(c.componentId);
                const hasOverrides = audit?.hasOverrides ?? false;
                const packMissing = audit?.packDataMissing ?? false;
                return (
                  <div
                    key={c.componentId}
                    className="rounded-xl border border-slate-200 hover:border-orange-200 hover:bg-orange-50/40 transition-colors"
                  >
                    <button
                      onClick={() => toggleComponent(c.componentId)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{c.componentName}</span>
                        <span className="text-xs text-slate-400">{c.measurementType}</span>
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
                      <div className="flex items-center gap-3 text-xs text-slate-500">
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

                    {expanded && audit && (
                      <div className="border-t border-slate-100 px-3 py-3">
                        <AuditDetail audit={audit} />
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => copyToClipboard(formatAuditAsText(audit))}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => downloadAudit(c.componentName, audit)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Download .txt
                          </button>
                        </div>
                      </div>
                    )}
                    {expanded && !audit && (
                      <div className="border-t border-slate-100 px-3 py-3">
                        <p className="text-xs text-slate-400">
                          No audit data available. Save the component to generate a calc trace.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
