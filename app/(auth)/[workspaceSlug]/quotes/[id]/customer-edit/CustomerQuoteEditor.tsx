'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { QuoteRow, QuoteRoofAreaRow, QuoteComponentRow } from '@/app/lib/types';

interface Props {
  quote: QuoteRow;
  roofAreas: QuoteRoofAreaRow[];
  components: QuoteComponentRow[];
  workspaceSlug: string;
}

interface QuoteLine {
  id: string;
  type: 'component' | 'custom';
  componentId?: string;
  text: string;
  amount: number;
  isVisible: boolean;
  sortOrder: number;
}

export function CustomerQuoteEditor({ quote, roofAreas, components, workspaceSlug }: Props) {
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize lines from components on mount
  useEffect(() => {
    const initialLines: QuoteLine[] = components
      .filter(c => c.is_customer_visible)
      .map((c, idx) => ({
        id: c.id,
        type: 'component' as const,
        componentId: c.id,
        text: generateDefaultText(c),
        amount: (c.material_cost || 0) + (c.labour_cost || 0),
        isVisible: true,
        sortOrder: idx,
      }));
    setLines(initialLines);
  }, [components]);

  function generateDefaultText(component: QuoteComponentRow): string {
    const qty = component.final_quantity?.toFixed(1) || '0.0';
    const unit = component.measurement_type === 'area' ? 'm²' : 
                 component.measurement_type === 'linear' ? 'm' : 'units';
    return `${component.name} — ${qty} ${unit}`;
  }

  function toggleVisibility(lineId: string) {
    setLines(prev => prev.map(l => 
      l.id === lineId ? { ...l, isVisible: !l.isVisible } : l
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
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const newLines = [...prev];
      [newLines[idx], newLines[idx + 1]] = [newLines[idx + 1], newLines[idx]];
      return newLines.map((l, i) => ({ ...l, sortOrder: i }));
    });
  }

  const visibleLines = lines.filter(l => l.isVisible);
  const subtotal = visibleLines.reduce((sum, l) => sum + l.amount, 0);
  const tax = subtotal * (quote.tax_rate / 100);
  const total = subtotal + tax;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${workspaceSlug}/quotes/${quote.id}/summary`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back to Summary
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">
              Customer Quote Editor — Quote #{quote.quote_number || 'Draft'}
            </h1>
          </div>
          <div className="text-sm text-slate-500">
            {lastSaved && `Last saved ${lastSaved.toLocaleTimeString()}`}
            {saving && ' (saving...)'}
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel: Component Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Components & Items</h2>
            
            <div className="space-y-2">
              {lines.map(line => (
                <div
                  key={line.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={line.isVisible}
                    onChange={() => toggleVisibility(line.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${line.isVisible ? 'text-slate-900' : 'text-slate-400'}`}>
                      {line.text}
                    </p>
                    <p className={`text-sm font-medium ${line.isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                      ${line.amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveUp(line.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      disabled={line.sortOrder === 0}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveDown(line.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      disabled={line.sortOrder === lines.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
              + Add Custom Line
            </button>

            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-slate-500">
                {lastSaved ? `Auto-saved ${Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago` : 'Not saved yet'}
              </p>
              <button className="w-full py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                Save & Generate PDF
              </button>
            </div>
          </div>

          {/* Right Panel: Live Preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Customer Quote Preview</h2>
            
            <div className="space-y-4 border-t pt-4">
              {/* Header */}
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">
                  QUOTE #{quote.quote_number || 'DRAFT'}
                </h3>
                <p className="text-sm text-slate-600">Client: {quote.customer_name}</p>
                {quote.job_name && (
                  <p className="text-sm text-slate-600">Job: {quote.job_name}</p>
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
                        <p className="text-sm text-slate-900">{line.text}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          ${line.amount.toFixed(2)}
                        </p>
                        <button className="p-1 text-slate-400 hover:text-slate-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium text-slate-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tax ({quote.tax_rate}%)</span>
                  <span className="font-medium text-slate-900">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span className="text-slate-900">Total</span>
                  <span className="text-slate-900">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
