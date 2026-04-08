'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { QuoteRow, QuoteComponentRow } from '@/app/lib/types';
import { formatCurrency } from '@/app/lib/currency/currencies';

interface Props {
  quote: QuoteRow;
  components: QuoteComponentRow[];
  workspaceSlug: string;
}

interface LaborLine {
  id: string;
  componentId: string;
  componentName: string;
  laborCost: number;
  isVisible: boolean;
  showPrice: boolean;
  showUnits: boolean;
  includeInTotal: boolean;
  sortOrder: number;
}

export function LaborSheetEditor({ quote, components, workspaceSlug }: Props) {
  const [lines, setLines] = useState<LaborLine[]>(
    components.map((c, idx) => ({
      id: c.id,
      componentId: c.id,
      componentName: c.name,
      laborCost: c.labour_cost || 0,
      isVisible: true,
      showPrice: true,
      showUnits: true,
      includeInTotal: true,
      sortOrder: idx,
    }))
  );

  const currency = quote.currency || 'NZD';

  function toggleVisibility(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, isVisible: !l.isVisible } : l
    ));
  }

  function toggleShowPrice(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, showPrice: !l.showPrice } : l
    ));
  }

  function toggleShowUnits(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, showUnits: !l.showUnits } : l
    ));
  }

  function toggleIncludeInTotal(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, includeInTotal: !l.includeInTotal } : l
    ));
  }

  function moveUp(lineId: string) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === lineId);
      if (idx <= 0) return prev;
      const newLines = [...prev];
      [newLines[idx - 1], newLines[idx]] = [newLines[idx], newLines[idx - 1]];
      return newLines.map((l, i) => ({ ...l, sortOrder: i }));
    });
  }

  function moveDown(lineId: string) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === lineId);
      if (idx >= prev.length - 1) return prev;
      const newLines = [...prev];
      [newLines[idx], newLines[idx + 1]] = [newLines[idx + 1], newLines[idx]];
      return newLines.map((l, i) => ({ ...l, sortOrder: i }));
    });
  }

  const visibleLines = lines.filter(l => l.isVisible);
  const subtotal = lines.filter(l => l.includeInTotal).reduce((sum, l) => sum + l.laborCost, 0);
  const tax = subtotal * (quote.tax_rate / 100);
  const total = subtotal + tax;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${workspaceSlug}/quotes/${quote.id}`}
              className="text-sm text-slate-600 hover:text-slate-900 mb-2 inline-block"
            >
              ← Back to Quote
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Labor Sheet</h1>
            <p className="text-sm text-slate-600 mt-1">
              Quote #{quote.quote_number || 'DRAFT'} • {quote.customer_name}
            </p>
          </div>
          <button className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">
            📄 Download PDF
          </button>
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel: Labor Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Labor Items</h2>
            
            <div className="space-y-2">
              {lines.map(line => (
                <div
                  key={line.id}
                  className={`px-2 py-1.5 rounded-lg border ${
                    line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-sm ${line.isVisible ? 'text-slate-900' : 'text-slate-400'}`}>
                          {line.componentName} (Labor Only)
                        </p>
                        <p className={`text-sm font-medium ${line.isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                          {formatCurrency(line.laborCost, currency)}
                        </p>
                      </div>
                      {/* Horizontal checkbox row */}
                      <div className="flex items-center gap-4 mt-1">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.isVisible}
                            onChange={() => toggleVisibility(line.id)}
                            className="w-3.5 h-3.5 text-orange-600 rounded"
                          />
                          Show
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.showPrice}
                            onChange={() => toggleShowPrice(line.id)}
                            disabled={!line.isVisible}
                            className="w-3.5 h-3.5 text-orange-600 rounded disabled:opacity-30"
                          />
                          Price
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.showUnits}
                            onChange={() => toggleShowUnits(line.id)}
                            disabled={!line.isVisible}
                            className="w-3.5 h-3.5 text-orange-600 rounded disabled:opacity-30"
                          />
                          Units
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.includeInTotal}
                            onChange={() => toggleIncludeInTotal(line.id)}
                            className="w-3.5 h-3.5 text-orange-600 rounded"
                          />
                          Add $
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(line.id)}
                        className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        disabled={line.sortOrder === 0}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDown(line.id)}
                        className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        disabled={line.sortOrder === lines.length - 1}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Live Preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Labor Sheet Preview</h2>
            
            <div className="border-t pt-4">
              {/* Header */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  LABOR SHEET - QUOTE #{quote.quote_number || 'DRAFT'}
                </h3>
                <p className="text-base text-slate-900 mt-1">
                  <span className="font-semibold">Client:</span> {quote.customer_name}
                </p>
                {quote.job_name && (
                  <p className="text-base text-slate-900">
                    <span className="font-semibold">Job:</span> {quote.job_name}
                  </p>
                )}
              </div>

              {/* Line items */}
              <div className="space-y-2 border-t pt-4">
                {visibleLines.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No items selected</p>
                ) : (
                  visibleLines.map(line => (
                    <div key={line.id} className="flex items-start justify-between py-2 border-b border-slate-100">
                      <div className="flex-1">
                        <p className="text-sm text-slate-900">
                          {line.showUnits ? `${line.componentName} (Labor)` : line.componentName.split('—')[0].trim()}
                        </p>
                      </div>
                      {line.showPrice && (
                        <p className="text-sm font-medium text-slate-900">
                          {formatCurrency(line.laborCost, currency)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-4 border-t mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal (Labor)</span>
                  <span className="font-medium text-slate-900">{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tax ({quote.tax_rate}%)</span>
                  <span className="font-medium text-slate-900">{formatCurrency(tax, currency)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span className="text-slate-900">Total</span>
                  <span className="text-slate-900">{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
