'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DirectoryLibrary } from '../../actions';

type ComponentPreview = {
  id: string;
  name: string;
  component_type: string;
  measurement_type: string;
  default_material_rate: number;
  default_labour_rate: number;
  pack_price: number | null;
  pack_size: number | null;
  pricing_strategy: string;
  sku: string | null;
  takeoff_slot: string | null;
};

export function LibraryDetail({
  workspaceSlug,
  library,
  components,
}: {
  workspaceSlug: string;
  library: DirectoryLibrary;
  components: ComponentPreview[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(components.map(c => c.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  const selectedCount = selected.size;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Breadcrumb */}
        <Link
          href={`/${workspaceSlug}/supplier-directory`}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 mb-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Directory
        </Link>

        {/* Library header */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-slate-900">{library.public_title || library.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">by {library.supplier_name}</p>
              {library.public_description && (
                <p className="text-sm text-slate-600 mt-2">{library.public_description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {library.roofing_types?.map(rt => (
                  <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rt}</span>
                ))}
                {library.brands?.map(b => (
                  <span key={b} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{b}</span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-semibold text-slate-900">{components.length}</div>
              <div className="text-xs text-slate-400">components</div>
            </div>
          </div>
        </div>

        {/* Component list */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700">
              {selectedCount > 0 ? `${selectedCount} selected` : 'Components'}
            </span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer">Select All</button>
              {selectedCount > 0 && (
                <button onClick={deselectAll} className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer">Clear</button>
              )}
            </div>
          </div>

          {components.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No components in this library.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {components.map(comp => (
                <div
                  key={comp.id}
                  className={`flex items-center gap-3 px-4 py-3 transition cursor-pointer ${
                    selected.has(comp.id) ? 'bg-orange-50/50' : 'hover:bg-orange-50/30'
                  }`}
                  onClick={() => toggleSelect(comp.id)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(comp.id)}
                    onChange={() => toggleSelect(comp.id)}
                    className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">{comp.name}</span>
                      {comp.sku && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">SKU: {comp.sku}</span>
                      )}
                      {comp.takeoff_slot && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{comp.takeoff_slot}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {comp.component_type} - {comp.measurement_type} - {comp.pricing_strategy}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {comp.pack_price != null ? (
                      <div className="text-sm font-medium text-slate-900">
                        ${comp.pack_price.toFixed(2)}
                        <span className="text-xs text-slate-400">/pack</span>
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-900">
                        ${comp.default_material_rate.toFixed(2)}
                        <span className="text-xs text-slate-400">/unit</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Import button (Phase 8 - disabled for now) */}
        <div className="flex gap-2">
          <button
            disabled
            className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed"
            title="Import functionality coming soon"
          >
            Import Selected ({selectedCount})
          </button>
          <Link
            href={`/${workspaceSlug}/supplier-directory`}
            className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
