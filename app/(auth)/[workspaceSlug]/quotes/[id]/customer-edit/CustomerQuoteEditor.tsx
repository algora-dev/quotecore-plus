'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { QuoteRow, QuoteRoofAreaRow, QuoteComponentRow } from '@/app/lib/types';
import { QuotePreview } from './QuotePreview';
import { AddCustomLineModal } from './AddCustomLineModal';

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
  roofAreaId?: string;
  text: string;
  amount: number;
  showPrice: boolean;
  isVisible: boolean;
  sortOrder: number;
}

export function CustomerQuoteEditor({ quote, roofAreas, components, workspaceSlug }: Props) {
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAddCustomLine, setShowAddCustomLine] = useState(false);

  // Initialize lines from components on mount
  useEffect(() => {
    const initialLines: QuoteLine[] = components
      .filter(c => c.is_customer_visible)
      .map((c, idx) => ({
        id: c.id,
        type: 'component' as const,
        componentId: c.id,
        roofAreaId: c.quote_roof_area_id || undefined,
        text: generateDefaultText(c),
        amount: (c.material_cost || 0) + (c.labour_cost || 0),
        showPrice: true,
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

  function addCustomLine(text: string, amount: number, showPrice: boolean) {
    const newLine: QuoteLine = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      text,
      amount,
      showPrice,
      isVisible: true,
      sortOrder: lines.length,
    };
    setLines(prev => [...prev, newLine]);
  }

  // Group lines by roof area
  const linesByArea = lines.reduce((acc, line) => {
    const areaId = line.roofAreaId || 'extras';
    if (!acc[areaId]) acc[areaId] = [];
    acc[areaId].push(line);
    return acc;
  }, {} as Record<string, QuoteLine[]>);

  const visibleLines = lines.filter(l => l.isVisible);
  const subtotal = visibleLines.reduce((sum, l) => sum + l.amount, 0); // Include ALL amounts in total
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
            
            <div className="space-y-4">
              {/* Grouped by roof areas */}
              {roofAreas.map(area => {
                const areaLines = linesByArea[area.id] || [];
                if (areaLines.length === 0) return null;
                return (
                  <div key={area.id} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700 px-2">{area.label}</h3>
                    {areaLines.map(line => (
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
                );
              })}

              {/* Extras / ungrouped */}
              {linesByArea['extras'] && linesByArea['extras'].length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 px-2">Extras & Custom</h3>
                  {linesByArea['extras'].map(line => (
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
              )}
            </div>

            <button 
              onClick={() => setShowAddCustomLine(true)}
              className="w-full py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Customer Quote Preview</h2>
              <button
                onClick={() => setShowPreviewModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                🔍 Preview Full Size
              </button>
            </div>
            
            <div className="border-t pt-4">
              <QuotePreview
                quote={quote}
                lines={visibleLines}
                subtotal={subtotal}
                tax={tax}
                total={total}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full-size Preview Modal */}
      {showPreviewModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setShowPreviewModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Full Size Preview</h2>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-8">
              <QuotePreview
                quote={quote}
                lines={visibleLines}
                subtotal={subtotal}
                tax={tax}
                total={total}
                showEditButtons={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Line Modal */}
      {showAddCustomLine && (
        <AddCustomLineModal
          onAdd={addCustomLine}
          onClose={() => setShowAddCustomLine(false)}
        />
      )}
    </div>
  );
}
